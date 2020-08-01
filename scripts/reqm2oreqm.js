/* Main class for managing oreqm xml data */
"use strict";

const accepted_safety_class_links_re = [
  /^\w+:>\w+:$/,           // no safetyclass -> no safetyclass
  /^\w+:QM>\w+:$/,         // QM -> no safetyclass
  /^\w+:SIL-2>\w+:$/,      // SIL-2 -> no safetyclass
  /^\w+:QM>\w+:QM$/,       // QM -> QM
  /^\w+:SIL-2>\w+:QM$/,    // SIL-2 -> QM
  /^\w+:SIL-2>\w+:SIL-2$/, // SIL-2 -> SIL-2
  /^impl.*>.*$/,           // impl can cover anything (maybe?)
  /^swintts.*>.*$/,        // swintts can cover anything (maybe?)
  /^swuts.*>.*$/           // swuts can cover anything (maybe?)
]

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
    this.problems = []             // [ Str ] problems reports
    this.dot = 'digraph "" {label="Select filter criteria and exclusions, then click\\l                    [update graph]\\l(Unfiltered graphs may be too large to render)"\n  labelloc=b\n  fontsize=24\n  fontcolor=grey\n  fontname="Arial"\n}\n'

    // Initialization logic
    this.process_oreqm_content(content);
    this.read_req_descriptions();
    this.add_fulfilledby_nodes();
    this.find_links();
    let problems = this.get_problems()
    if (problems) {
      //alert(problems)
    }
  }

  set_svg_guide() {
    this.dot = 'digraph "" {label="Select filter criteria and exclusions, then click\\l                    [update graph]\\l(Unfiltered graphs may be too large to render)"\n  labelloc=b\n  fontsize=24\n  fontcolor=grey\n  fontname="Arial"\n}\n'
  }

  process_oreqm_content(content) {
    let parser = new DOMParser();
    this.root = parser.parseFromString(content, "text/xml");
  }

  read_req_descriptions() {
    let specobjects_list = this.root.getElementsByTagName("specobjects");
    for (const specobjects of specobjects_list) {
      let doctype = specobjects.getAttributeNode("doctype").value;
      if (!this.doctypes.has(doctype)) {
        this.doctypes.set(doctype, []);
      }
      this.read_specobject_list(specobjects, doctype);
    }
  }

  read_specobject_list(node, doctype) {
    // Read individual specobjects
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
      req.linksto         = get_linksto(comp),
      req.needsobj        = get_list_of(comp, 'needsobj'),
      req.platform        = get_list_of(comp, 'platform'),
      req.rationale       = get_xml_text(comp, 'rationale'),
      req.safetyclass     = get_xml_text(comp, 'safetyclass'),
      req.safetyrationale = get_xml_text(comp, 'safetyrationale'),
      req.shortdesc       = get_xml_text(comp, 'shortdesc'),
      req.source          = get_xml_text(comp, 'source'),
      req.sourcefile      = "" // this breaks comparisons // get_xml_text(comp, 'sourcefile'),
      req.sourceline      = "" // this breaks comparisons // get_xml_text(comp, 'sourceline'),
      req.status          = get_xml_text(comp, 'status'),
      req.tags            = get_list_of(comp, 'tag'),
      req.usecase         = get_xml_text(comp, 'usecase'),
      req.verifycrit      = get_xml_text(comp, 'verifycrit'),
      req.version         = get_xml_text(comp, 'version');
      req.ffb_placeholder = false;

      if (this.requirements.has(req.id)) {
        let problem = "<id> duplicated: {} ".format(req.id)
        //console.log("redefinition of ", req.id)
        this.problem_report(problem)
      }
      while (this.requirements.has(req.id)) {
        // Add suffix until unique
        req.id += '_dup_'
      }
      this.requirements.set(req.id, req)
      let dt_arr = this.doctypes.get(doctype)
      if (!dt_arr.includes(req.id)) {
        dt_arr.push(req.id)
        this.doctypes.set(doctype, dt_arr) // keep status per doctype
      } else {
        //console.log("duplicate id ", req.id)
      }
      //console.log(req);
    }
  }

  add_fulfilledby_nodes() {
    // Create placeholders for absent fulfilledby requirements.
    // add doctype to needsobj if not present
    const ids = Array.from(this.requirements.keys())
    let new_nodes = new Map() // need a new container to add after loop
    for (let req_id of ids) {
      const rec = this.requirements.get(req_id)
      let ffb_list = Array.from(rec.fulfilledby)
      for (let ff_arr of ffb_list) {
        const ff_id = ff_arr[0]
        const ff_doctype = ff_arr[1]
        const ff_version = ff_arr[2]
        if (!this.requirements.has(ff_id)) {
            // Create placeholder for ffb node
            let new_node = {
              "comment": '',
              "dependson": [],
              "description": "*FULFILLEDBY PLACEHOLDER*",
              "doctype": ff_doctype,
              "fulfilledby": [],
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
              "version": ff_version,
              "ffb_placeholder" : true
            }
            new_nodes.set(ff_id, new_node)
        } else {
          // check for matching doctype
          const real_dt = this.requirements.get(ff_id).doctype
          if (real_dt !== ff_doctype) {
            let problem = "ffbType {} does not match {} for <id> {}".format(ff_doctype, real_dt, ff_id)
            this.problem_report(problem)
          }
        }
        // Add pseudo needsobj with '*' suffix
        if (!rec.needsobj.includes(ff_doctype) &&
            !rec.needsobj.includes(ff_doctype+'*')) {
          rec.needsobj.push(ff_doctype+'*')
          this.requirements.set(req_id, rec)
        }
        // Add new doctype list if unknown
        if (!this.doctypes.has(ff_doctype)) {
          this.doctypes.set(ff_doctype, [])
        }
        // Add id to list if new
        let dt_arr = this.doctypes.get(ff_doctype)
        if (!dt_arr.includes(ff_id)) {
          dt_arr.push(ff_id)
          this.doctypes.set(ff_doctype, dt_arr)
        }
      }
    }
    const new_keys = new_nodes.keys()
    for (const key of new_keys) {
      //console.log(key, new_nodes[key])
      if (!this.requirements.has(key)) {
        this.requirements.set(key, new_nodes.get(key))
      }
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
        this.linksto.set(req_id, this.linksto.get(req_id).add(link.linksto))

        // top-down
        if (!this.linksto_rev.has(link.linksto)) {
          this.linksto_rev.set(link.linksto, new Set())
        }
        lt_set = this.linksto_rev.get(link.linksto)
        lt_set.add(req_id)
        this.linksto_rev.set(link.linksto, lt_set)
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
    //console.log(this.requirements.get(req_id).doctype)
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
      if (this.requirements.has(ghost_id)) { // Ghost may not exist
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
    // and return lists of new, modified and removed <id>s"""
    // Requirements with no description are ignored
    const new_ids = Array.from(this.requirements.keys())
    let new_reqs = []
    let updated_reqs = []
    let removed_reqs = []
    this.remove_ghost_requirements(false)
    for (const req_id of new_ids) {
      const rec = this.requirements.get(req_id)
      // skip 'impl' and similar
      if ((rec.description.length === 0) && (rec.shortdesc.length === 0)) {
        continue;
      }
      // compare json versions
      if (stringEqual(this.requirements.get(req_id), old_reqs.requirements.get(req_id))) {
        continue // skip unchanged or nondescript reqs
      }
      if (old_reqs.requirements.has(req_id)) {
          updated_reqs.push(req_id)
      } else {
          new_reqs.push(req_id)
      }
    }
    const old_ids = old_reqs.requirements.keys()
    for (const req_id of old_ids) {
      let old_rec = old_reqs.requirements.get(req_id)
      if ((old_rec.description.length === 0) && (old_rec.shortdesc.length === 0)) {
        continue;
      }
      if (!new_ids.includes(req_id)) { // <id> no longer present -> removed
        removed_reqs.push(req_id)
        // Create 'ghost' requirement
        this.requirements.set(req_id, old_rec)
        // check if this introduces a new doctype
        if (!this.doctypes.has(old_rec.doctype)) {
          this.doctypes.set(old_rec.doctype, [])
        }
        // Update doctype table with new counts (and types)
        let dt_arr = this.doctypes.get(old_rec.doctype)
        dt_arr.push(req_id)
        this.doctypes.set(old_rec.doctype, dt_arr)
      }
    }
    this.find_links() // Select the changed ones (if wanted)
    this.new_reqs = new_reqs
    this.updated_reqs = updated_reqs
    this.removed_reqs = removed_reqs
    let result = new Object()
    result.new_reqs = new_reqs
    result.updated_reqs = updated_reqs
    result.removed_reqs = removed_reqs
    return result
  }

  decorate_id(req_id) {
    // prefix <id> with new:, chg: or rem: if changed
    let id_str = req_id
    if (this.new_reqs.includes(req_id)) {
      id_str = 'new:' + req_id
    } else if (this.updated_reqs.includes(req_id)) {
      id_str = 'chg:' + req_id
    } else if (this.removed_reqs.includes(req_id)) {
      id_str = 'rem:' + req_id
    }
    return id_str
  }

  find_reqs_with_name(regex) {
    // Check <id> against regex
    const ids = this.requirements.keys()
    let rx = new RegExp(regex, 'i')
    let matches = []
    for (const id of ids) {
      const decorated_id = this.decorate_id(id)
      if (decorated_id.search(rx) >= 0)
        matches.push(id)
    }
    return matches
  }

  get_all_text(req_id) {
    // Get all text fields as combined string
    const rec = this.requirements.get(req_id)
    let id_str = this.decorate_id(req_id)
    let ffb = []
    rec.fulfilledby.forEach(element =>
      ffb.push('ffb:'+element[0]))
    let all_text = rec.description
          + '\n' + rec.furtherinfo
          + '\n' + rec.rationale
          + '\n' + rec.safetyrationale
          + '\n' + rec.shortdesc
          + '\n' + rec.usecase
          + '\n' + rec.verifycrit
          + '\n' + rec.comment
          + '\n' + ffb.join('\n')
          + '\n' + rec.tags.join('\n')
          + '\n' + rec.platform.join('\n')
          + '\n' + id_str  // req_id is last to ensure regex search for <id>$ will succeed
    return all_text
  }

  find_reqs_with_text(regex) {
    // Check requirement texts against regex
    const ids = this.requirements.keys()
    let rx = new RegExp(regex, 'im')
    let matches = []
    for (const id of ids) {
      if (rx.test(this.get_all_text(id)))
        matches.push(id)
    }
    return matches
  }

  color_up_down(id_list, color_up_value, color_down_value) {
    // Color from all nodes in id_list both up and down
    //console.log(id_list)
    let full_list = id_list //.concat(this.new_reqs, this.updated_reqs, this.removed_reqs)
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
`digraph "" {
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
    let selected_dict = new Map()
    let sel_arr = []
    for (const req_id of ids) {
      const rec = this.requirements.get(req_id)
      if (!doctype_dict.has(rec.doctype)) {
        doctype_dict.set(rec.doctype, [])
        selected_dict.set(rec.doctype, [])
      }
      if (selection_function(req_id, rec, this.color.get(req_id)) &&
          !this.excluded_doctypes.includes(rec.doctype) &&
          !this.excluded_ids.includes(req_id)) {
        subset.push(req_id)
        let dt = doctype_dict.get(rec.doctype)
        dt.push(req_id)
        doctype_dict.set(rec.doctype, dt)
        if (highlights.includes(req_id)) {
          sel_arr = selected_dict.get(rec.doctype)
          sel_arr.push(req_id)
          selected_dict.set(rec.doctype, sel_arr)
        }
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
        let dot_id = req_id //.replace(/\./g, '_').replace(' ', '_')
        if (this.new_reqs.includes(req_id)) {
          node = 'subgraph "cluster_{}_new" { color=limegreen penwidth=1 label="new" fontname="Arial" labelloc="t"\n{}}\n'.format(dot_id, node)
        } else if (this.updated_reqs.includes(req_id)) {
          node = 'subgraph "cluster_{}_changed" { color=goldenrod1 penwidth=1 label="changed" fontname="Arial" labelloc="t"\n{}}\n'.format(dot_id, node)
        } else if (this.removed_reqs.includes(req_id)) {
          node = 'subgraph "cluster_{}_removed" { color=red penwidth=1 label="removed" fontname="Arial" labelloc="t"\n{}}\n'.format(dot_id, node)
        }
        if (highlights.includes(req_id)) {
          node = 'subgraph "cluster_{}" { id="sel_{}" color=maroon3 penwidth=3 label=""\n{}}\n'.format(dot_id, dot_id, node)
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
    result.selected_dict = selected_dict
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

  check_node_id(name) {
    return this.requirements.has(name)
  }

  safety_doctype(id, safety) {
    // construct a doctype name, qualified with safetyclass
    let rec = this.requirements.get(id)
    if (safety) {
      return "{}:{}".format(rec.doctype, rec.safetyclass)
    } else {
      return rec.doctype
    }
  }

  linksto_safe(from, to) {
    // permitted safetyclass for providescoverage <from_safetyclass>:<to_safetyclass>

    let combo = "{}>{}".format(from, to)
    for (const re of accepted_safety_class_links_re) {
      if (combo.match(re)) {
        return true
      }
    }
    return false
  }

  linksto_safe_color(from, to) {
    return this.linksto_safe(from, to) ? '#00AA00' : '#FF0000'
  }

  scan_doctypes(doctype_safety) {
    // Scan all requirements and summarize the relationships between doctypes
    // with counts of instances and relations (needsobj, linksto, fulfilledby)
    // When doctype_safety is true, the doctypes are qualified with the safetyclass
    // of the requirement as in <doctype>:<safetyclass> and these are the nodes rendered
    let dt_map = new Map() // A map of { doctype_name : Doctype }
    let id_list = this.requirements.keys()
    let doctype = null
    let dest_doctype = null
    let basic_doctype = null
    let doctype_clusters = new Map() // {doctype : [doctype:safetyclass]}
    for (const id of id_list) {
      if (this.requirements.get(id).ffb_placeholder === true) {
        // skip placeholders
        continue;
      }
      // make a cluster of doctypes with the different safetyclasses
      basic_doctype = this.requirements.get(id).doctype
      if (!doctype_clusters.has(basic_doctype)) {
        doctype_clusters.set(basic_doctype, [])
      }
      doctype = this.safety_doctype(id, doctype_safety)
      if (!dt_map.has(doctype)) {
        dt_map.set(doctype, new Doctype(doctype))
        // Create clusters of refined doctypes, based on fundamental one
        if (!doctype_clusters.get(basic_doctype).includes(doctype)) {
          doctype_clusters.get(basic_doctype).push(doctype)
        }
      }

      //
      dt_map.get(doctype).add_instance(id)
      // linksto
      if (this.linksto.has(id)) {
        const linksto = Array.from(this.linksto.get(id))
        for (let linked_id of linksto) {
          if (this.requirements.has(linked_id)) {
            dest_doctype = this.safety_doctype(linked_id, doctype_safety)
            //console.log("add_linksto ", doctype, linked_id, dest_doctype)
            dt_map.get(doctype).add_linksto(dest_doctype, linked_id)
          }
        }
      }
      // needsobj
      let need_list = Array.from(this.requirements.get(id).needsobj)
      for (let need of need_list) {
        if (!need.endsWith('*')) {
          if (doctype_safety) {
            // will need at least its own safetyclass
            dest_doctype = "{}:{}".format(need, this.requirements.get(id).safetyclass)
          } else {
            dest_doctype = need
          }
          //console.log("add_needsobj ", dest_doctype)
          dt_map.get(doctype).add_needsobj(dest_doctype)
        }
      }
      // fulfilledby
      let ffb_list = Array.from(this.requirements.get(id).fulfilledby)
      for (let ffb of ffb_list) {
        if (doctype_safety) {
          // will need at least its own safetyclass
          dest_doctype = "{}:{}".format(ffb[1], this.requirements.get(id).safetyclass)
        } else {
          dest_doctype = ffb[1]
        }
        //console.log("add_fulfilledby ", dest_doctype)
        dt_map.get(doctype).add_fulfilledby(dest_doctype, ffb[0])
      }

    }
    // DOT language start of diagram
    let graph = `digraph "" {
      rankdir="TD"
      node [shape=plaintext fontname="Arial" fontsize=16]
      edge [color="black" dir="forward" arrowhead="normal" arrowtail="normal" fontname="Arial" fontsize=11];

`
    // Define the doctype nodes - the order affects the layout
    const doctype_array = Array.from(doctype_clusters.keys())
    for (let doctype of doctype_array) {
      let doctypes_in_cluster = doctype_clusters.get(doctype)
      let sc_stats = ''
      let count_total = 0
      let sc_list = Array.from(doctypes_in_cluster.keys())
      sc_list.sort()
      let sc_string = ''
      for (const sub_doctype of doctypes_in_cluster) {
        let dt = dt_map.get(sub_doctype)
        let sc = sub_doctype.split(':')[1]
        sc_string += '</TD><TD port="{}">{}: {} '.format(sc_str(sc), sc_str(sc), dt.count)
        count_total += dt.count
      }
      if (doctype_safety) {
        sc_stats = '\n          <TR><TD>safetyclass:{}</TD></TR>'.format(sc_string)
      }
      let dt_node = `\
      "{}" [label=<
        <TABLE BGCOLOR="{}" BORDER="1" CELLSPACING="0" CELLBORDER="1" COLOR="black" >
        <TR><TD COLSPAN="5" CELLSPACING="0" >doctype: {}</TD></TR>
        <TR><TD COLSPAN="5" ALIGN="LEFT">specobject count: {}</TD></TR>{}
      </TABLE>>];\n\n`.format(
          doctype,
          get_color(doctype),
          doctype,
          count_total,
          sc_stats)
      graph += dt_node
    }
    let dt
    let count
    let doctype_edges = Array.from(dt_map.keys())
    // Loop over doctypes
    for (let doctype of doctype_edges) {
      dt = dt_map.get(doctype)
      // Needsobj links
      graph += '# linkage from {}\n'.format(doctype)
      let need_keys = Array.from(dt.needsobj.keys())
      if (!doctype_safety) {
        for (let nk of need_keys) {
          count = dt.needsobj.get(nk)
          graph += ' "{}" -> "{}" [label="need({}){} " style="dotted"]\n'.format(
            doctype.split(':')[0],
            nk.split(':')[0],
            count,
            doctype_safety ? '\n{}'.format(dt_sc_str(doctype)) : '')
        }
      }
      // linksto links
      let lt_keys = Array.from(dt.linksto.keys())
      for (let lk of lt_keys) {
        count = dt.linksto.get(lk).length
        graph += ' "{}" -> "{}" [label="linksto({}){} " color="{}"]\n'.format(
          doctype.split(':')[0],
          lk.split(':')[0],
          count,
          doctype_safety ? '\n{}:{}'.format(dt_sc_str(doctype), dt_sc_str(lk)) : '',
          doctype_safety ? this.linksto_safe_color(doctype, lk) : 'black')
      }
      // fulfilledby links
      let ffb_keys = Array.from(dt.fulfilledby.keys())
      for (let ffb of ffb_keys) {
        count = dt.fulfilledby.get(ffb).length
        graph += ' "{}" -> "{}" [label="fulfilledby({}){} " color="{}" style="dashed"]\n'.format(
          doctype.split(':')[0],
          ffb.split(':')[0],
          count,
          doctype_safety ? '\n{}:{}'.format(dt_sc_str(ffb),dt_sc_str(doctype)) : '',
          doctype_safety ? this.linksto_safe_color(ffb, doctype) : 'purple')
      }
    }
    let rules = ''
    if (doctype_safety) {
      rules = xml_escape(JSON.stringify(accepted_safety_class_links_re, 0, 2))
      rules = rules.replace(/\n/mg, '<BR ALIGN="LEFT"/> ')
    }
    graph += '\n  label={}\n  labelloc=b\n  fontsize=14\n  fontcolor=black\n  fontname="Arial"\n'.format(
      construct_graph_title(false, rules))
    graph += '\n}\n'
    //console.log(graph)
    this.dot = graph
    return graph
  }

  doctypes_rank() {
    // Return an array of doctypes in abstraction level order.
    // Could be the order of initial declaration in oreqm
    // For now this is it.
    return Array.from(this.doctypes.keys())
  }

  problem_report(report) {
    // report problems and suppress duplicates
    if (!this.problems.includes(report)) {
      this.problems.push(report)
      document.getElementById('issueCount').innerHTML = this.problems.length
    }
  }

  get_problems() {
    // Get a list of problems as string. Empty string -> no problems
    return this.problems.join('\n')
  }

  clear_problems() {
    this.problems = []
    document.getElementById('issueCount').innerHTML = this.problems.length
  }

  get_tag_text_formatted(rec, tag) {
    let xml_txt = ''
    if (rec.hasOwnProperty(tag)) {
      let txt = rec[tag]
      let template = "\n    <{}>{}</{}>"
      if (txt.length) {
        xml_txt = template.format(tag, txt, tag)
      }
    }
    return xml_txt
  }

  get_list_formatted(rec, field) {
    let xml_txt = ''
    if (rec.hasOwnProperty(field)) {
      let list = rec[field]
      let template = "\n    <{}>{}</{}>"
      if (list.length) {
        xml_txt = "\n{}: ".format(field)
        if (field==='linksto') {
          xml_txt = '\n    <providescoverage>'
          for (let i=0; i<list.length; i++) {
            xml_txt += `
      <provcov>
        <linksto>{}</linksto>
        <dstversion>{}</dstversion>
      </provcov>`.format(list[i].linksto, list[i].dstversion)
          }
          xml_txt += '\n    </providescoverage>'
        } else if (field==='needsobj') {
          xml_txt = '\n    <needscoverage>'
          for (let i=0; i<list.length; i++) {
            if (list[i].includes('*')) continue;
            xml_txt += `
      <needscov><needsobj>{}</needsobj></needscov>`.format(list[i])
          }
          xml_txt += '\n    </needscoverage>'
        } else if (field==='tags') {
          xml_txt = '\n    <tags>'
          for (let i=0; i<list.length; i++) {
            xml_txt += `
      <tag>{}</tag>`.format(list[i])
          }
          xml_txt += '\n    </tags>'
        } else if (field==='platform') {
          xml_txt = '\n    <platforms>'
          for (let i=0; i<list.length; i++) {
            xml_txt += `
      <platform>{}</platform>`.format(list[i])
          }
          xml_txt += '\n    </platforms>'
        } else if (field==='fulfilledby') {
          xml_txt = '\n    <fulfilledby>'
          for (let i=0; i<list.length; i++) {
            xml_txt += `
      <ffbObj>
        <ffbId>{}</ffbId>
        <ffbType>{}</ffbType>
        <ffbVersion>{}</ffbVersion>
      </ffbObj>`.format(list[i][0], list[i][1], list[i][2])
          }
          xml_txt += '\n    </fulfilledby>'
        } else {
          xml_txt = template.format(field, list.join(', '), field)
        }
      }
    }
    return xml_txt
  }

  get_node_text_formatted(id) {
    // Reconstruct a XML representation
    let xml_txt = ""
    if (this.requirements.has(id)) {
      let rec = this.requirements.get(id)
      let indent = '      '
      let template = `\
<specobjects doctype="{}">
  <specobject>
    <id>{}</id>
    <status>{}</status>{}
  </specobject>
</specobjects>
`
      let optional = ''
      optional    += this.get_tag_text_formatted(rec, 'source', indent)
      optional    += this.get_tag_text_formatted(rec, 'version', indent)
      optional    += this.get_tag_text_formatted(rec, 'shortdesc', indent)
      optional    += this.get_tag_text_formatted(rec, 'description', indent)
      optional    += this.get_tag_text_formatted(rec, 'rationale', indent)
      optional    += this.get_tag_text_formatted(rec, 'comment', indent)
      optional    += this.get_tag_text_formatted(rec, 'furtherinfo', indent)
      optional    += this.get_tag_text_formatted(rec, 'safetyclass', indent)
      optional    += this.get_tag_text_formatted(rec, 'safetyrationale', indent)
      optional    += this.get_tag_text_formatted(rec, 'verifycrit', indent)
      optional    += this.get_tag_text_formatted(rec, 'source', indent)
      optional    += this.get_list_formatted(rec, 'tags', indent)
      optional    += this.get_list_formatted(rec, 'fulfilledby', indent)
      optional    += this.get_list_formatted(rec, 'platform', indent)
      optional    += this.get_list_formatted(rec, 'needsobj', indent)
      optional    += this.get_list_formatted(rec, 'linksto', indent)
      xml_txt = template.format(rec.doctype, rec.id, rec.status, optional)
    }
    return xml_txt
  }

}

function sc_str(sc) {
  // Show the empty safetyclass as 'none'
  return (sc === '') ? 'none' : sc
}

function dt_sc_str(doctype_with_safetyclass) {
  // return string representation of safetyclass part of doctype
  return sc_str(doctype_with_safetyclass.split(':')[1])
}
