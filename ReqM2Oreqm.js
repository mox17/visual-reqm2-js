class ReqM2Oreqm {
  // This class reads and manages information in ReqM2 .oreqm files
  constructor(content, excluded_doctypes, excluded_ids) {
    this.root = null;              // xml tree
    this.doctypes = new Map();     // { doctype : [id] }  List of ids of a specific doctype
    this.requirements = new Map(); // { id : Requirement}
    this.color = new Map();        // {id:[color]}
    this.linksto = new Map();      // {id:{id}} -- map to set of linked ids
    this.linksto_rev = new Map();  // {id:{id}} -- reverse direction of linksto. i.e. top-down
    this.fulfilledby = new Map();  // {id:{id}}
    this.excluded_doctypes = excluded_doctypes; // [doctype]
    this.excluded_ids = excluded_ids; // [id]
    this.new_reqs = [];            // List of new requirements (from comparison)
    this.updated_reqs = [];        // List of updated requirements (from comparison)
    this.removed_reqs = [];        // List of removed requirements (copies taken from older(?) version of oreqm)
    this.visible_nodes = new Map(); // {doctype:[id]}
    this.dot = 'digraph intro_tips {label="Select filter criteria and exclusions, then click\\l                    [Update graph]\\l(Unfiltered graphs may be too large to render)"\n  labelloc=b\n  fontsize=24\n  fontcolor=grey\n  fontname="Arial"\n}\n'

    // Initialization logic
    this.process_oreqm_content(content);
    this.read_req_descriptions();
    this.add_fulfilledby_nodes();
    this.find_links();
  }

  process_oreqm_content(content) {
    let parser = new DOMParser();
    this.root = parser.parseFromString(content, "text/xml");
  }

  read_req_descriptions() {
    let specobjects = this.root.getElementsByTagName("specobjects");
    for (const specobject of specobjects) {
      let doctype = specobject.getAttributeNode("doctype").value;
      if (!this.doctypes.has(doctype)) {
        this.doctypes.set(doctype, []);
      }
      this.read_specobject_list(specobject, doctype);
    }
  }

  read_specobject_list(node, doctype) {
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

      this.requirements.set(req.id, req)
      let dt_arr = this.doctypes.get(doctype)
      dt_arr.push(req.id)
      this.doctypes.set(doctype, dt_arr) // keep status per doctype
      //console.log(req);
    }
  }

  add_fulfilledby_nodes() {
    // Create placeholders for absent fulfilledby requirements.
    // add doctype to needsobj if not present
    const ids = this.requirements.keys()
    let new_nodes = new Map()
    for (const req_id of ids) {
      const rec = this.requirements.get(req_id)
      for (const ff_arr of rec.fulfilledby) {
        const ff_id = ff_arr[0]
        const ff_doctype = ff_arr[1]
        const ff_version = ff_arr[2]
        if (!this.requirements.has(ff_id)) {
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
            new_nodes.set(ff_id, new_node)
        }
        if (!rec.needsobj.includes(ff_doctype) &&
            !rec.needsobj.includes(ff_doctype+'*')) {
          rec.needsobj.push(ff_doctype+'*')
          this.requirements.set(req_id, rec)
        }
        if (!this.doctypes.has(ff_doctype)) {
          this.doctypes.set(ff_doctype, [])
        }
        let dt_arr = this.doctypes.get(ff_doctype)
        dt_arr.push(ff_id)
        this.doctypes.set(ff_doctype, dt_arr)
      }
    }
    const new_keys = new_nodes.keys()
    for (const key of new_keys) {
      //console.log(key, new_nodes[key])
      this.requirements.set(key, new_nodes.get(key))
    }
  }

  find_links() {
    // Populate the linksto and reverse linksto_rev dicts with the linkages in the requirements.
    // Ensure that color dict has all valid ids
    const ids = this.requirements.keys()
    // Clear any previous results
    this.linksto = new Map()
    this.linksto_rev = new Map()
    let lt_set
    // Check all requirements
    for (const req_id of ids) {
      const rec = this.requirements.get(req_id)
      for (const link of rec.linksto) {
        //console.log(req_id, link)
        // bottom-up
        if (!this.linksto.has(req_id)) {
            this.linksto.set(req_id, new Set())
        }
        this.linksto.set(req_id, this.linksto.get(req_id).add(link))

        // top-down
        if (!this.linksto_rev.has(link)) {
          this.linksto_rev.set(link, new Set())
        }
        lt_set = this.linksto_rev.get(link)
        lt_set.add(req_id)
        this.linksto_rev.set(link, lt_set)
      }
      for (const ffb_arr of rec.fulfilledby) {
        const ffb_link = ffb_arr[0]
        // top-down
        if (!this.linksto_rev.has(req_id)) {
          this.linksto_rev.set(req_id, new Set())
        }
        let ffb_set = this.linksto_rev.get(req_id)
        ffb_set.add(ffb_link)
        this.linksto_rev.set(req_id, ffb_set)

        if (!this.fulfilledby.has(ffb_link)) {
          this.fulfilledby.set(ffb_link, new Set())
        }
        ffb_set = this.fulfilledby.get(ffb_link)
        ffb_set.add(req_id)
        this.fulfilledby.set(ffb_link, ffb_set)

        // bottom-up
        if (!this.linksto.has(ffb_link)) {
          this.linksto.set(ffb_link, new Set())
        }
        lt_set = this.linksto.get(ffb_link)
        lt_set.add(req_id)
        this.linksto.set(ffb_link, lt_set)
      }
      this.color.set(req_id, new Set())
    }
  }

  color_down(color, req_id) {
    //Color this id and linksto_rev referenced nodes with color
    if (!this.color.has(req_id)) {
      return // unknown <id> (bug)
    }
    if (this.color.get(req_id).has(color)) {
      return // already visited
    }
    if (this.excluded_doctypes.includes(this.requirements.get(req_id).doctype)) {
      return // blacklisted doctype
    }
    if (this.excluded_ids.includes(req_id)) {
      return // blacklisted id
    }
    let col_set = this.color.get(req_id)
    col_set.add(color)
    this.color.set(req_id, col_set)
    if (this.linksto_rev.has(req_id)) {
      for (const child of this.linksto_rev.get(req_id)) {
        this.color_down(color, child)
      }
    }
  }

  color_up(color, req_id) {
    //Color this id and linksto referenced nodes with color
    if (!this.color.has(req_id)) {
      return // unknown <id> (bug)
    }
    if (this.color.get(req_id).has(color)) {
      return // already visited
    }
    if (this.excluded_doctypes.includes(this.requirements.get(req_id).doctype)) {
      return // blacklisted doctype
    }
    if (this.excluded_ids.includes(req_id)) {
      return // blacklisted id
    }
    let col_set = this.color.get(req_id)
    col_set.add(color)
    this.color.set(req_id, col_set)
    if (this.linksto.has(req_id)) {
      for (const child of this.linksto.get(req_id)) {
        this.color_up(color, child)
      }
    }
  }

  get_time() {
    // Extract execution timestamp from oreqm report
    const time = get_xml_text(this.root, "timestamp")
    return time
  }

  remove_ghost_requirements(find_again) {
    // A comparison may add 'ghost' requirements, which represent deleted
    // requirements. Remove these 'ghost' requirements
    for (const ghost_id of this.removed_reqs) {
      const rec = this.requirements.get(ghost_id)
      let dt_list = this.doctypes.get(rec.doctype)
      dt_list.remove(ghost_id)
      if (dt_list.length) {
        this.doctypes.set(rec.doctype, dt_list)
      } else {
        this.doctypes.delete(rec.doctype)
      }
      this.requirements.delete(ghost_id)
    }
    this.removed_reqs = []
    this.new_reqs = []
    this.updated_reqs = []
    if (find_again) {
      this.find_links()
    }
    update_doctype_table()
  }

  compare_requirements(old_reqs) {
    // Compare two sets of requirements (instances of ReqM2Oreqm)
    // and return lists of new and modified <id>s"""
    const new_ids = Array.from(this.requirements.keys())
    let new_reqs = []
    let updated_reqs = []
    let removed_reqs = []
    this.remove_ghost_requirements(false)
    for (const req_id of new_ids) {
      if (old_reqs.requirements.has(req_id) &&
        stringEqual(this.requirements.get(req_id), old_reqs.requirements.get(req_id))) {
        continue // skip unchanged reqs
      }
      if (this.requirements.has(req_id)) {
        const rec = this.requirements.get(req_id)
        // Ignore requirements with no description, such as 'impl'
        if (rec.description.length || rec.shortdesc.length) {
          if (old_reqs.requirements.has(req_id)) {
              updated_reqs.push(req_id)
          } else {
              new_reqs.push(req_id)
          }
        }
      }
    }
    const old_ids = old_reqs.requirements.keys()
    for (const req_id of old_ids) {
      if (!new_ids.includes(req_id)) {
        removed_reqs.push(req_id)
        let req = old_reqs.requirements.get(req_id)
        this.requirements.set(req_id, req)
        if (!this.doctypes.has(req.doctype)) {
          this.doctypes.set(req.doctype, [])
        }
        let dt_arr = this.doctypes.get(req.doctype)
        dt_arr.push(req_id)
        this.doctypes.set(req.doctype, dt_arr)
      }
    }
    this.find_links()
    this.new_reqs = new_reqs
    this.updated_reqs = updated_reqs
    this.removed_reqs = removed_reqs
    let result = new Object()
    result.new_reqs = new_reqs
    result.updated_reqs = updated_reqs
    result.removed_reqs = removed_reqs
    return result
  }

  find_reqs_with_name(regex) {
    // Check <id> against regex
    const ids = this.requirements.keys()
    let rx = new RegExp(regex, 'i')
    let matches = []
    for (const id of ids) {
      if (id.search(rx) >= 0)
        matches.push(id)
    }
    return matches
  }

  get_all_text(req_id) {
    // Get all text fields as combined string
    const rec = this.requirements.get(req_id)
    let all_text = req_id
      + '\n' + rec.description
      + '\n' + rec.furtherinfo
      + '\n' + rec.rationale
      + '\n' + rec.safetyrationale
      + '\n' + rec.shortdesc
      + '\n' + rec.usecase
      + '\n' + rec.verifycrit
      + '\n' + rec.comment
      + '\n' + rec.tags.join('\n')
      + '\n' + rec.platform.join('\n')
    return all_text
  }

  find_reqs_with_text(regex) {
    // Check requirement texts against regex
    const ids = this.requirements.keys()
    let rx = new RegExp(regex, 'i')
    let matches = []
    for (const id of ids) {
      if (this.get_all_text(id).search(rx) >= 0)
        matches.push(id)
    }
    return matches
  }

  color_up_down(id_list, color_up_value, color_down_value) {
    // Color from all nodes in id_list both up and down
    //console.log(id_list)
    let full_list = id_list.concat(this.new_reqs, this.updated_reqs, this.removed_reqs)
    for (const res of full_list) {
      this.color_down(color_down_value, res)
      this.color_up(color_up_value, res)
    }
  }

  clear_colors() {
    // Clear the 'color' tags on the requirements
    const ids = this.color.keys()
    for (const id of ids) {
      this.color.set(id, new Set())
    }
  }

  get_doctypes() {
    return this.doctypes
  }

  get_dot() {
    // return current graph
    return this.dot
  }

  // Fixed texts that form part of dot file
  static get DOT_PREAMBLE() {
    const preamble =
`digraph requirements {
  rankdir="RL"
  node [shape=plaintext fontname="Arial" fontsize=16]
  edge [color="blue",dir="forward",arrowhead="normal",arrowtail="normal"];

`;
    return preamble;
  }

  static get DOT_EPILOGUE() {
    const epilogue = '\n}\n';
    return epilogue;
  }

  create_graph(selection_function, top_doctype, title, highlights) {
    // Return a 'dot' compatible graph with the subset of nodes nodes
    // accepted by the selection_function.
    // The 'TOP' node forces a sensible layout for highest level requirements
    // (some level of visual proximity and aligned to the left of the graph)
    let graph = ReqM2Oreqm.DOT_PREAMBLE;
    let subset = []
    const ids = this.requirements.keys()
    let node_count = 0
    let edge_count = 0
    let doctype_dict = new Map()
    for (const req_id of ids) {
      const rec = this.requirements.get(req_id)
      if (!doctype_dict.has(rec.doctype)) {
        doctype_dict.set(rec.doctype, [])
      }
      if (selection_function(req_id, rec, this.color.get(req_id)) &&
          !this.excluded_doctypes.includes(rec.doctype) &&
          !this.excluded_ids.includes(req_id)) {
        subset.push(req_id)
        let dt = doctype_dict.get(rec.doctype)
        dt.push(req_id)
        doctype_dict.set(rec.doctype, dt)
      }
    }
    let show_top = this.doctypes.has(top_doctype) && !this.excluded_doctypes.includes(top_doctype)
    if (show_top) {
      graph += '  "TOP" [fontcolor=lightgray];\n\n'
    }
    for (const req_id of subset) {
        // nodes
        const ghost = this.removed_reqs.includes(req_id)
        let node = format_node(req_id, this.requirements.get(req_id), ghost)
        let dot_id = req_id.replace(/\./g, '_').replace(' ', '_')
        if (this.new_reqs.includes(req_id)) {
          node = 'subgraph "cluster_{}" { color=limegreen penwidth=3 label="new" fontname="Arial" labelloc="t"\n{}}\n'.format(dot_id, node)
        } else if (this.updated_reqs.includes(req_id)) {
          node = 'subgraph "cluster_{}" { color=goldenrod1 penwidth=3 label="changed" fontname="Arial" labelloc="t"\n{}}\n'.format(dot_id, node)
        } else if (this.removed_reqs.includes(req_id)) {
          node = 'subgraph "cluster_{}" { color=red penwidth=3 label="removed" fontname="Arial" labelloc="t"\n{}}\n'.format(dot_id, node)
        } else if (highlights.includes(req_id)) {
          node = 'subgraph "cluster_{}" { color=maroon3 penwidth=3 label=""\n{}}\n'.format(dot_id, node)
        }
        graph += node + '\n'
        node_count += 1
    }
    graph += '\n  # Edges\n'
    if (show_top) {
      for (const req_id of subset) {
        if (this.requirements.get(req_id).doctype === top_doctype) {
          graph += format_edge(req_id, 'TOP')
        }
      }
    }
    let kind = ''
    for (const req_id of subset) {
      // edges
      if (this.linksto.has(req_id)) {
        for (const link of this.linksto.get(req_id)) {
          // Do not reference non-selected specobjets
          if (subset.includes(link)) {
            if (this.fulfilledby.has(req_id) && this.fulfilledby.get(req_id).has(link)) {
              kind = "fulfilledby"
            } else {
              kind = null
            }
            graph += format_edge(req_id, link, kind)
            edge_count += 1
          }
        }
      }
    }
    graph += '\n  label={}\n  labelloc=b\n  fontsize=18\n  fontcolor=black\n  fontname="Arial"\n'.format(title)
    graph += ReqM2Oreqm.DOT_EPILOGUE
    this.dot = graph
    let result = new Object()
    //result.graph = graph
    result.node_count = node_count
    result.edge_count = edge_count
    result.doctype_dict = doctype_dict
    return result
  }

  set_excluded_doctypes(doctypes) {
    // Set excluded doctypes
    this.excluded_doctypes = doctypes
  }

  set_excluded_ids(ids) {
    // Set excluded doctypes
    this.excluded_ids = ids
  }

  get_excluded_doctypes() {
    // Get excluded doctypes
    return this.excluded_doctypes
  }

  get_excluded_ids() {
    // Get excluded doctypes
    return this.excluded_ids
  }

  get_main_ref_diff() {
    // Return the lists of ids
    let diff = new Object()
    diff.new_reqs = this.new_reqs
    diff.updated_reqs = this.updated_reqs
    diff.removed_reqs = this.removed_reqs
    return diff
  }

  get_node_count() {
    return this.requirements.size
  }

}
