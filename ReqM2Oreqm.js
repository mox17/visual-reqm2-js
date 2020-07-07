class ReqM2Oreqm {
  // This class reads and manages information in ReqM2 .oreqm files
  constructor(content, excluded_doctypes, excluded_ids) {
    this.content = content;
    this.root = null;              // xml tree
    this.doctypes = new Map();     // { doctype : [id] }  List of ids of a specific doctype
    this.requirements = new Map(); // { id : Requirement}
    this.color = new Map();        // {id:[color]}
    this.linksto = new Map();      // {id:{id}} -- map to set of linked ids
    this.linksto_rev = new Map();  // {id:{id}} -- reverse direction of linksto. i.e. top-down
    this.fulfilledby = new Set();  // {(from,to)}
    this.excluded_doctypes = excluded_doctypes; // [doctype]
    this.excluded_ids = excluded_ids; // [id]
    this.new_reqs = [];            // List of new requirements (from comparison)
    this.updated_reqs = [];        // List of updated requirements (from comparison)

    // Initialization logic
    this.process_oreqm_content();
    this.get_req_descriptions();
    this.add_fulfilledby_nodes();
    this.find_links();
  }

  process_oreqm_content() {
    var parser = new DOMParser();
    this.root = parser.parseFromString(this.content, "text/xml");
  }

  get_req_descriptions() {
    let specobjects = this.root.getElementsByTagName("specobjects");
    for (const specobject of specobjects) {
      let doctype = specobject.getAttributeNode("doctype").value;
      if (!this.doctypes.hasOwnProperty(doctype)) {
        this.doctypes[doctype] = [];
      }
      this.get_specobject_list(specobject, doctype);
    }
  }

  get_specobject_list(node, doctype) {
    let specobject_list = node.getElementsByTagName("specobject");
    for (const comp of specobject_list) {
      let req = new Object();
      req.id              = get_xml_text(comp, 'id');
      req.comment         = get_xml_text(comp, 'comment'),
      req.dependson       = get_list_of(comp, 'dependson'),
      req.description     = get_xml_text(comp, 'description');
      req.doctype         = doctype,
      req.fulfilledby     = get_fulfilledby(comp),
      req.furtherinfo     = get_xml_text(comp, 'furtherinfo'),
      req.linksto         = get_list_of(comp, 'linksto'),
      req.needsobj        = get_list_of(comp, 'needsobj'),
      req.platform        = get_list_of(comp, 'platform'),
      req.rationale       = get_xml_text(comp, 'rationale'),
      req.safetyclass     = get_xml_text(comp, 'safetyclass'),
      req.safetyrationale = get_xml_text(comp, 'safetyrationale'),
      req.shortdesc       = get_xml_text(comp, 'shortdesc'),
      req.source          = get_xml_text(comp, 'source'),
      req.sourcefile      = get_xml_text(comp, 'sourcefile'),
      req.sourceline      = get_xml_text(comp, 'sourceline'),
      req.status          = get_xml_text(comp, 'status'),
      req.tags            = get_list_of(comp, 'tag'),
      req.usecase         = get_xml_text(comp, 'usecase'),
      req.verifycrit      = get_xml_text(comp, 'verifycrit'),
      req.version         = get_xml_text(comp, 'version');

      this.requirements[req.id] = req;
      //console.log(req);
    }
  }

  add_fulfilledby_nodes() {
    // Create placeholders for absent fulfilledby requirements.
    // add doctype to needsobj if not present
    const ids = Object.keys(this.requirements)
    let new_nodes = new Map()
    for (const req_id of ids) {
      const rec = this.requirements[req_id]
      for (const ff_arr of rec.fulfilledby) {
        const ff_id = ff_arr[0]
        const ff_doctype = ff_arr[1]
        const ff_version = ff_arr[2]
        if (!ids.includes(ff_id)) {
            // Create dummy node
            let new_node = {
              "comment": '',
              "dependson": [],
              "description": "*FULFILLEDBY PLACEHOLDER*",
              "doctype": ff_doctype,
              "fulfilledby": '',
              "furtherinfo": '',
              "id": ff_id,
              "linksto": [],
              "needsobj": [],
              "platform": [],
              "rationale": '',
              "safetyclass": '',
              "safetyrationale": '',
              "shortdesc": '',
              "source": '',
              "sourcefile": '',
              "sourceline": '',
              "status": '',
              "tags": [],
              "usecase": "",
              "verifycrit": '',
              "version": ff_version
            }
            new_nodes[ff_id] = new_node
        }
        if (!this.requirements[req_id].needsobj.includes(ff_doctype) &&
            !this.requirements[req_id].needsobj.includes(ff_doctype+'*')) {
          this.requirements[req_id].needsobj.push(ff_doctype+'*')
        }
      }
    }
    const new_keys = Object.keys(new_nodes)
    for (const key of new_keys) {
      //console.log(key, new_nodes[key])
      this.requirements[key] = new_nodes[key]
    }
  }

  find_links() {
    // Populate the linksto and reverse linksto_rev dicts with the linkages in the requirements.
    // Ensure that color dict has all valid ids
    const ids = Object.keys(this.requirements)
    for (const req_id of ids) {
      const rec = this.requirements[req_id]
      for (const link of rec.linksto) {
        //console.log(req_id, link)
        // bottom-up
        if (!this.linksto.hasOwnProperty(req_id)) {
            this.linksto[req_id] = new Set()
        }
        this.linksto[req_id].add(link)
        // top-down
        if (!this.linksto_rev.hasOwnProperty(link)) {
          this.linksto_rev[link] = new Set()
        }
        this.linksto_rev[link].add(req_id)
      }
      for (const ffb_arr of rec.fulfilledby) {
        const ffb_link = ffb_arr[0]
        // top-down
        if (!this.linksto_rev.hasOwnProperty(req_id)) {
          this.linksto_rev[req_id] = new Set()
        }
        this.linksto_rev[req_id].add(ffb_link)
        let ffb = []
        ffb.push(req_id)
        ffb.push(ffb_link)
        this.fulfilledby.add(ffb)
        // bottom-up
        if (!this.linksto.hasOwnProperty(ffb_link)) {
          this.linksto[ffb_link] = new Set()
        }
        this.linksto[ffb_link].add(req_id)
      }
      this.color[req_id] = new Set()
    }
  }

  color_down(color, req_id) {
    //Color this id and linksto_rev referenced nodes with color
    if (!this.color.hasOwnProperty(req_id)) {
      return // unknown <id> (bug)
    }
    if (this.color[req_id].hasOwnProperty(color)) {
      return // already visited
    }
    if (this.excluded_doctypes.includes(this.requirements[req_id].doctype)) {
      return // blacklisted doctype
    }
    if (this.excluded_ids.includes(req_id)) {
      return // blacklisted id
    }
    this.color[req_id].add(color)
    if (this.linksto_rev.hasOwnProperty(req_id)) {
      for (const child of this.linksto_rev[req_id]) {
        this.color_down(color, child)
      }
    }
  }

  color_up(color, req_id) {
    //Color this id and linksto referenced nodes with color
    if (!this.color.hasOwnProperty(req_id)) {
      return // unknown <id> (bug)
    }
    if (this.color[req_id].hasOwnProperty(color)) {
      return // already visited
    }
    if (this.excluded_doctypes.includes(this.requirements[req_id].doctype)) {
      return // blacklisted doctype
    }
    if (this.excluded_ids.includes(req_id)) {
      return // blacklisted id
    }
    this.color[req_id].add(color)
    if (this.linksto.hasOwnProperty(req_id)) {
      for (const child of this.linksto[req_id]) {
        this.color_up(color, child)
      }
    }
  }

  get_time() {
    // Extract execution timestamp from oreqm report
    time = get_xml_text(this.root, "timestamp")
    return time
  }

  compare_requirements(old_reqs) {
    // Compare two sets of requirements (instances of ReqM2Oreqm)
    // and return lists of new and modified <id>s"""
    const new_ids = Object.keys(this.requirements)
    let new_reqs = []
    let updated_reqs = []
    for (const req_id of new_ids) {
      if (req_id in old_reqs.requirements &&
          this.requirements[req_id] == old_reqs.requirements[req_id]) {
        continue // skip unchanged reqs
      }
      if (req_id in self.requirements) {
        const rec = this.requirements[req_id]
        // Ignore requirements with no description, such as 'impl'
        if (rec.description.length || rec.shortdesc.length) {
          if (req_id in old_reqs.requirements) {
              updated_reqs.push(req_id)
          } else {
              new_reqs.push(req_id)
          }
        }
      }
    }
    this.new_reqs = new_reqs
    this.updated_reqs = updated_reqs
    return new_reqs, updated_reqs
  }

  find_reqs_with_name(regex) {
    // Check <id> against regex
    const ids = Object.keys(this.requirements)
    let matches = []
    const re = new RegExp(regex, RegExp.prototype.ignoreCase)
    for (const id of ids) {
      if (re.search(id) >= 0)
        matches.push(id)
    }
    return matches
  }

  get_all_text(req_id) {
    // Get all text fields
    const rec = this.requirements[req_id]
    let all_text = req_id
      + '\n' + rec.description
      + '\n' + rec.furtherinfo
      + '\n' + rec.rationale
      + '\n' + rec.safetyrationale
      + '\n' + rec.shortdesc
      + '\n' + rec.usecase
      + '\n' + rec.verifycrit
      + '\n' + rec.comment
    return all_text
  }

  find_reqs_with_text(regex) {
    // Check requirement texts against regex
    ids = list(self.requirements.keys())
    const ids = Object.keys(this.requirements)
    let matches = []
    const re = new RegExp(regex, RegExp.prototype.ignoreCase)
    for (const id of ids) {
      if (re.search(get_all_text(id)) >= 0)
        matches.push(id)
    }
    return matches
  }

  color_up_down(id_list, color_up_value, color_down_value) {
    // Color from all nodes in id_list both up and down
    for (const res of id_list) {
      this.color_down(color_down_value, res)
      this.color_up(color_up_value, res)
    }
  }

}
