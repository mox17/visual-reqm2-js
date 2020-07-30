  "use strict";

  var beforeUnloadMessage = null;

  var resizeEvent = new Event("paneresize");
  Split(['#oreqm_div', '#graph'], {
    sizes: [15, 85],
    onDragEnd: function() {
      var svgOutput = document.getElementById("svg_output");
      if (svgOutput != null) {
        svgOutput.dispatchEvent(resizeEvent);
      }
    }
  });

  var parser = new DOMParser();
  var worker;
  var result;
  var title
  var oreqm_main
  var oreqm_main_filename = 'no file selected'
  var oreqm_main_timestamp = 'no time'
  var oreqm_ref
  var oreqm_ref_filename = ''
  var oreqm_ref_timestamp = ''
  var image_type = 'none'
  var image_mime = ''
  var image_data = ''
  var image_data_url = ''
  var auto_update = true
  var search_pattern = '' // regex for matching requirements
  var id_checkbox = false // flag for scope of search
  var dot_source = ''
  var panZoom = null

  document.getElementById("auto_update").checked = auto_update

  function viz_working_set() {
    document.getElementById("viz_working").innerHTML = '<span style="color: #ff0000">WORKING</span>'
  }

  function viz_working_clear() {
    document.getElementById("viz_working").innerHTML = '<span style="color: #000000"></span>'
  }

  function updateGraph() {
    if (worker) {
      worker.terminate();
    }

    clear_diagram()

    document.querySelector("#output").classList.add("working");
    document.querySelector("#output").classList.remove("error");

    worker = new Worker("./scripts/worker.js");

    worker.onmessage = function(e) {
      document.querySelector("#output").classList.remove("working");
      document.querySelector("#output").classList.remove("error");

      result = e.data;

      viz_working_clear()
      updateOutput();
    }

    worker.onerror = function(e) {
      document.querySelector("#output").classList.remove("working");
      document.querySelector("#output").classList.add("error");

      var message = e.message === undefined ? "An error occurred while processing the graph input." : e.message;

      var error = document.querySelector("#error");
      while (error.firstChild) {
        error.removeChild(error.firstChild);
      }

      document.querySelector("#error").appendChild(document.createTextNode(message));

      console.error(e);
      console.log(dot_source)
      viz_working_clear()
      e.preventDefault();
    }

    dot_source = oreqm_main != null ? oreqm_main.get_dot() : "digraph foo {\nfoo -> bar\nfoo -> baz\n}\n"
    var params = {
      src: dot_source,
      options: {
        engine: "dot", //document.querySelector("#engine select").value,
        format: document.querySelector("#format select").value
        , totalMemory: 4 * 16 * 1024 *1024
      }
    };

    // Instead of asking for png-image-element directly, which we can't do in a worker,
    // ask for SVG and convert when updating the output.

    if (params.options.format === "png-image-element") {
      params.options.format = "svg";
    }

    if (document.querySelector("#format select").value === 'dot-source') {
      updateOutput();
    } else {
      worker.postMessage(params);
      viz_working_set()
    }
  }

  var selected_node = ''
  var svg_element = null

  function clear_diagram() {
    const graph = document.querySelector("#output");

    var svg = graph.querySelector("svg");
    if (svg) {
      graph.removeChild(svg);
    }

    var text = graph.querySelector("#text");
    if (text) {
      graph.removeChild(text);
    }

    var img = graph.querySelector("img");
    if (img) {
      graph.removeChild(img);
    }
  }

  function updateOutput() {
    const graph = document.querySelector("#output");

    var svg = graph.querySelector("svg");
    if (svg) {
      graph.removeChild(svg);
    }

    var text = graph.querySelector("#text");
    if (text) {
      graph.removeChild(text);
    }

    var img = graph.querySelector("img");
    if (img) {
      graph.removeChild(img);
    }

    if (!result) {
      return;
    }

    if (document.querySelector("#format select").value === "svg" && !document.querySelector("#raw input").checked) {
      svg_element = parser.parseFromString(result, "image/svg+xml").documentElement;
      svg_element.id = "svg_output";
      graph.appendChild(svg_element);

      panZoom = svgPanZoom(svg_element, {
        panEnabled: true,
        zoomEnabled: true,
        dblClickZoomEnabled: false,
        controlIconsEnabled: true,
        preventMouseEventsDefault: false,
        fit: true,
        center: true,
        minZoom: 0.02,
        maxZoom: 200,
        zoomScaleSensitivity: 0.3
      });

      svg_element.addEventListener('paneresize', function(e) {
        panZoom.resize();
      }, false);
      window.addEventListener('resize', function(e) {
        panZoom.resize();
      });

      /*
      // This time, add the listener to the graph itself
      svg_element.addEventListener('click', event => {
        let str = ""
        if (!event.altKey) { // This test allows Alt-drag to function
          // Grab all the siblings of the element that was actually clicked on
          for (const sibling of event.target.parentElement.children) {
            // Check if they're the title
            if (sibling.nodeName != 'title') continue;
            str = sibling.innerHTML;
            break;
          }
          const ta = document.createElement('textarea');
          ta.value = str;
          ta.setAttribute('readonly', '');
          ta.style = { position: 'absolute', left: '-9999px' };
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
      }); */

      svg_element.addEventListener('focus', function() {
        this.addEventListener('keypress', function(e) {
            //console.log(e.keyCode);
        });
      }, svg_element);

      document.getElementById('graph').onkeyup = function(e) {
        if (e.which == 78) {
          // alert("N key was pressed");
          next_selected()
        } else if (e.which == 80) {
          // alert("P key was pressed");
          prev_selected()
        // } else if (e.ctrlKey && e.which == 66) {
        //   alert("Ctrl + B shortcut combination was pressed");
        // } else if (e.ctrlKey && e.altKey && e.which == 89) {
        //   alert("Ctrl + Alt + Y shortcut combination was pressed");
        // } else if (e.ctrlKey && e.altKey && e.shiftKey && e.which == 85) {
        //   alert("Ctrl + Alt + Shift + U shortcut combination was pressed");
        }
        //console.log(e)
      };

      // context menu setup
      var menuNode = document.getElementById('node-menu');
      svg_element.addEventListener('contextmenu', event => {
        let str = ""
        event.preventDefault()
        // Grab all the siblings of the element that was actually clicked on
        for (const sibling of event.target.parentElement.children) {
          // Check if they're the title
          if (sibling.nodeName != 'title') continue;
          str = sibling.innerHTML;
          break;
        }
        selected_node = str
        if ((menuNode.style.display==='')||
            (menuNode.style.display==='none')||
            (menuNode.style.display==='initial')) {
          // show context menu
          let stage = document.getElementById('output');
          var containerRect = stage.getBoundingClientRect();
          menuNode.style.display = 'initial';
          menuNode.style.top = "0"
          menuNode.style.left = "0"
          update_menu_options(selected_node)
          let menu_width = menuNode.clientWidth
          let menu_height = menuNode.clientHeight
          let menu_rel_x = 2
          let menu_rel_y = 2
          if ((event.pageX+menu_width+menu_rel_x+20) >= containerRect.right) {
            menu_rel_x = -menu_rel_x - menu_width
          }
          if ((event.pageY+menu_height+menu_rel_y+28) >= containerRect.bottom) {
            menu_rel_y = -menu_rel_y - menu_height - 16 // compensate height of a row
          }
          menuNode.style.top  = /*containerRect.top  +*/ event.pageY + menu_rel_y + 'px';
          menuNode.style.left = /*containerRect.left +*/ event.pageX + menu_rel_x + 'px';
        } else {
          // Remove on 2nd right-click
          menuNode.style.display = 'none';
        }
      });

      window.addEventListener('click', function(e) {
        // hide context menu
        if (menuNode.style.display !== 'none') {
          menuNode.style.display = 'none';
          e.preventDefault();
        }
      });

      // Setup for download of image
      image_type = 'svg'
      image_mime = 'image/svg+xml'
      image_data = result
    } else if (document.querySelector("#format select").value === "png-image-element") {
      var image = Viz.svgXmlToPngImageElement(result);
      graph.appendChild(image);
      image_type = 'png'
      image_mime = 'image/png'
      image_data = image
    } else if (document.querySelector("#format select").value === "dot-source") {
      var text = document.createElement("div");
      text.id = "text";
      text.appendChild(document.createTextNode(dot_source));
      graph.appendChild(text);
      image_type = 'dot'
      image_mime = 'text/vnd.graphviz'
      image_data = result
    } else {
      var text = document.createElement("div");
      text.id = "text";
      text.appendChild(document.createTextNode(result));
      graph.appendChild(text);
      image_type = 'txt'
      image_mime = 'text/plain'
      image_data = result
    }
    set_download_link()
  }

  window.addEventListener("beforeunload", function(e) {
    return beforeUnloadMessage;
  });

  function copy_id_node() {
    const ta = document.createElement('textarea');
    ta.value = selected_node
    ta.setAttribute('readonly', '');
    ta.style = { position: 'absolute', left: '-9999px' };
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

  /*
  document.querySelector("#engine select").addEventListener("change", function() {
      updateGraph();
    }); */

  document.querySelector("#format select").addEventListener("change", function() {
    if (document.querySelector("#format select").value === "svg") {
      document.querySelector("#raw").classList.remove("disabled");
      document.querySelector("#raw input").disabled = false;
    } else {
      document.querySelector("#raw").classList.add("disabled");
      document.querySelector("#raw input").disabled = true;
    }

    updateGraph();
  });

  document.querySelector("#raw input").addEventListener("change", function() {
    updateOutput();
  });

  function update_menu_options(node_id) {
    // get individual context menu options as appropriate
    if (oreqm_main && oreqm_main.check_node_id(node_id)) {
      // a node was right-clicked
      document.getElementById('menu_copy_id').classList.remove('custom-menu_disabled')
      document.getElementById('menu_exclude').classList.remove('custom-menu_disabled')
      document.getElementById('menu_raw_txt').classList.remove('custom-menu_disabled')
      if (selected_node_check(node_id)) {
        // it is a selected node
        document.getElementById('menu_select').classList.add('custom-menu_disabled')
        document.getElementById('menu_deselect').classList.remove('custom-menu_disabled')
      } else {
        document.getElementById('menu_select').classList.remove('custom-menu_disabled')
        document.getElementById('menu_deselect').classList.add('custom-menu_disabled')
      }
    } else {
      // click not on nodes
      document.getElementById('menu_select').classList.add('custom-menu_disabled')
      document.getElementById('menu_deselect').classList.add('custom-menu_disabled')
      document.getElementById('menu_exclude').classList.add('custom-menu_disabled')
      document.getElementById('menu_copy_id').classList.add('custom-menu_disabled')
      document.getElementById('menu_raw_txt').classList.add('custom-menu_disabled')
    }
  }

  function set_doctype_count_shown(visible_nodes, selected_nodes) {
    // Update doctype table with counts of nodes actually displayed
    let doctypes = visible_nodes.keys()
    let shown_count = 0
    for (const doctype of doctypes) {
      let shown_cell = document.getElementById("doctype_shown_{}".format(doctype))
      if (shown_cell) {
        shown_cell.innerHTML = visible_nodes.get(doctype).length
        shown_count += visible_nodes.get(doctype).length
      }
    }
    let shown_cell_totals = document.getElementById("doctype_shown_totals")
    if (shown_cell_totals) {
      shown_cell_totals.innerHTML = shown_count
    }
    doctypes = selected_nodes.keys()
    let selected_count = 0
    for (const doctype of doctypes) {
      let selected_cell = document.getElementById("doctype_select_{}".format(doctype))
      if (selected_cell) {
        selected_cell.innerHTML = selected_nodes.get(doctype).length
        selected_count += selected_nodes.get(doctype).length
      }
    }
    let selected_cell_totals = document.getElementById("doctype_select_totals")
    if (selected_cell_totals) {
      selected_cell_totals.innerHTML = selected_count
    }
  }

  function update_doctype_table() {
    if (oreqm_main) {
      display_doctypes_with_count(oreqm_main.doctypes)
      if (auto_update) {
        filter_graph()
      }
    }
  }

  function display_doctypes_with_count(doctype_dict) {
    let doctype_names = Array.from(doctype_dict.keys())
    doctype_names.sort()
    let excluded = get_excluded_doctypes() // so we can tick them again
    //console.log(doctype_names)

    const element = document.getElementById("dyn_doctype_table");
    if (element) {
      element.parentNode.removeChild(element);
    }
    let table = document.createElement("table")
    table.id = "dyn_doctype_table"
    let row = table.insertRow();
    let cell
    table.className = 'doctype_table'
    cell = row.insertCell();
    cell.innerHTML = "<b>doctype</b>";
    cell = row.insertCell();
    cell.innerHTML = "<b>count</b>";
    cell = row.insertCell();
    cell.innerHTML = "<b>shown</b>";
    cell = row.insertCell();
    cell.innerHTML = "<b>select</b>";
    cell = row.insertCell();
    cell.innerHTML = "<b>exclude</b>";
    let doctype_totals = 0
    for (var i of doctype_names) {
      row = table.insertRow();
      row.style.backgroundColor = get_color(i)
      cell = row.insertCell();
      cell.innerHTML = i;

      cell = row.insertCell();
      cell.innerHTML = doctype_dict.get(i).length;
      doctype_totals += doctype_dict.get(i).length;

      cell = row.insertCell();
      cell.innerHTML = '<div id="doctype_shown_{}">0</div>'.format(i)

      cell = row.insertCell();
      cell.innerHTML = '<div id="doctype_select_{}">0</div>'.format(i)

      cell = row.insertCell();
      let checked = excluded.includes(i)
      cell.innerHTML = '<input type="checkbox" id="doctype_{}" {}>'.format(i, checked ? 'checked' : '')
      cell.addEventListener("click", function() {
        doctype_filter_change();
      });
    }
    // Totals row
    row = table.insertRow();
    cell = row.insertCell();
    cell.innerHTML = "totals:";

    cell = row.insertCell();
    cell.innerHTML = doctype_totals

    cell = row.insertCell();
    cell.innerHTML = '<div id="doctype_shown_totals">0</div>'

    cell = row.insertCell();
    cell.innerHTML = '<div id="doctype_select_totals">0</div>'

    cell = row.insertCell();

    document.getElementById("doctype_table").appendChild(table);
  }

  var toggle_doctype_exclude = false

  function doctype_filter_change() {
    if (!toggle_doctype_exclude) {
      //console.log("doctype_filter_change")
      if (auto_update) {
        filter_graph()
      }
    }
  }

  function auto_update_click() {
    //console.log("auto_update_click")
    auto_update = document.getElementById("auto_update").checked
    if (auto_update) {
      filter_graph()
    }
  }

  function filter_change() {
    //console.log("filter_change")
    if (auto_update) {
      filter_graph()
    }
  }

  function set_auto_update(state) {
    document.getElementById("auto_update").checked = state
    auto_update = state
  }


  function load_file_main(file) {
    clear_diagram()
    viz_working_set()
    // setting up the reader
    let reader = new FileReader();
    reader.readAsText(file,'UTF-8');
    reader.onload = readerEvent => {
      //console.log( file );
      oreqm_main = new ReqM2Oreqm(readerEvent.target.result, [], [])
      oreqm_main_filename = file.name
      oreqm_main_timestamp = oreqm_main.get_time()
      document.getElementById('name').innerHTML = oreqm_main_filename
      document.getElementById('size').innerHTML = (Math.round(file.size/1024))+" KiB"
      document.getElementById('timestamp').innerHTML = oreqm_main_timestamp
      const node_count = oreqm_main.get_node_count()
      if (auto_update && node_count > 500) {
        set_auto_update(false)
      }
      if (oreqm_ref) { // if we have a reference do a compare
        compare_oreqm()
      }
      display_doctypes_with_count(oreqm_main.get_doctypes())
      if (auto_update) {
        filter_graph()
      } else {
        oreqm_main.set_svg_guide()
        updateGraph()
      }
      let ref_button = document.getElementById('get_ref_oreqm')
      ref_button.disabled = false
      let clear_button = document.getElementById('clear_ref_oreqm')
      clear_button.disabled = false
    }
  }

  function get_main_oreqm_file() {
    let input = document.createElement('input');
    input.type = 'file';
    input.accept = '.oreqm'

    input.onchange = e => {
      // getting a hold of the file reference
      let file = e.target.files[0];
      clear_diagram()
      load_file_main(file)
    }
    input.click();
  }

  function load_file_ref(file) {
    // Load reference file
    if (oreqm_main) {
      let reader = new FileReader();
      reader.readAsText(file,'UTF-8');
      reader.onload = readerEvent => {
        //console.log( file );
        oreqm_main.remove_ghost_requirements()
        oreqm_ref = new ReqM2Oreqm(readerEvent.target.result, [], [])
        oreqm_ref_filename = file.name
        oreqm_ref_timestamp = oreqm_ref.get_time()
        document.getElementById('ref_name').innerHTML = oreqm_ref_filename
        document.getElementById('ref_size').innerHTML = (Math.round(file.size/1024))+" KiB"
        document.getElementById('ref_timestamp').innerHTML = oreqm_ref_timestamp
        compare_oreqm()
        display_doctypes_with_count(oreqm_main.get_doctypes())
        if (auto_update) {
          filter_graph()
        }
      }
    } else {
      alert("No main file selected")
    }
  }

  function get_ref_oreqm_file() {
    let input = document.createElement('input');
    input.type = 'file';
    input.accept = '.oreqm'

    input.onchange = e => {
      // getting a hold of the file reference
      let file = e.target.files[0];
      load_file_ref(file)
    }
    input.click();
  }

  function set_download_link() {
    let download = document.getElementById('download_image')
    let link = document.getElementById('a_link_id')
    if (!link) {
      link = document.createElement("a"); // Or maybe get it from the current document
      link.id = "a_link_id"
      download.appendChild(link); // Or append it whereever you want
      link.innerHTML = "download image";
    }
    var image_blob = new Blob([image_data], {type: image_mime})
    image_data_url = URL.createObjectURL(image_blob);
    link.href = image_data_url;
    link.download = "visual_reqm2.{}".format(image_type);
  }

  function get_excluded_doctypes() {
    // Get the list of doctypes with checked 'excluded' status
    let excluded_list = []
    if (oreqm_main) {
      const doctypes = oreqm_main.get_doctypes()
      const names = doctypes.keys()
      for (const doctype of names) {
        const cb_name = "doctype_{}".format(doctype)
        const status = document.getElementById(cb_name);
        if (status && status.checked) {
          excluded_list.push(doctype)
        }
        //console.log(doctype, status)
      }
    }
    return excluded_list
  }

  function toggle_exclude() {
    if (oreqm_main) {
      toggle_doctype_exclude = true
      const doctypes = oreqm_main.get_doctypes()
      const names = doctypes.keys()
      let ex_list = get_excluded_doctypes()
      for (const doctype of names) {
        const checkbox_id = "doctype_{}".format(doctype)
        const new_state = ex_list.length==0
        var elm = document.getElementById(checkbox_id);
        if (new_state != elm.checked) {
          elm.click();
        }
      }
      toggle_doctype_exclude = false
      doctype_filter_change();
    }
  }

  function get_search_regex_clean() {
    let raw_search = document.getElementById("search_regex").value
    let clean_search = raw_search.replace(/\n/g, '') // ignore all newlines in regex
    return clean_search
  }

  function filter_graph() {
    reset_selection()
    if (oreqm_main) {
      handle_pruning()
      // Collect filter criteria and generate .dot data
      id_checkbox = document.querySelector("#id_checkbox input").checked
      search_pattern = get_search_regex_clean()
      //console.log("filter_graph()", search_pattern)
      if (search_pattern) {
        if (id_checkbox) {
          id_search(search_pattern)
        } else {
          txt_search(search_pattern)
        }
      } else {
        // no pattern specified
        const graph = oreqm_main.create_graph(select_all, "reqspec1", construct_graph_title(), [])
        set_doctype_count_shown(graph.doctype_dict, graph.selected_dict)
      }
      updateGraph();
    }
  }

  function handle_pruning() {
    if (oreqm_main) {
      let ex_id_list = []
      const excluded_ids = document.getElementById("excluded_ids").value.trim()
      if (excluded_ids.length) {
        ex_id_list = excluded_ids.split(/[\n,]+/)
      }
      oreqm_main.set_excluded_ids(ex_id_list)
      let ex_dt_list = get_excluded_doctypes()
      oreqm_main.set_excluded_doctypes(ex_dt_list)
    }
  }

  var selected_nodes = []
  var selected_index = 0
  var selected_node = null
  var selected_polygon = null
  var selected_width = ""

  function reset_selection() {
    selected_nodes = []
    selected_index = 0
  }

  function set_selection(selection) {
    selected_nodes = selection
    selected_index = 0
  }

  function selected_node_check(node) {
    return selected_nodes.includes(node)
  }

  function clear_selection_highlight() {
    if (selected_polygon) {
      selected_polygon.stroke_width = selected_width
      selected_polygon = null
    }
  }

  function set_selection_highlight(node) {
    clear_selection_highlight()
    //let cluster_name = "cluster_{}".format()
    let outline = document.querySelector('.polygon');
    if (outline) {
      selected_polygon = outline
      selected_width = selected_polygon.stroke_width
      selected_polygon.stroke_width = "8"
    }
  }

  function prev_selected() {
    // step backwards through nodes and center display
    if (oreqm_main && selected_nodes.length) {
      if (selected_index > selected_nodes.length) selected_index = 0
      center_node(selected_nodes[selected_index])
      selected_index--
      if (selected_index < 0) selected_index = selected_nodes.length - 1
    }
  }

  function next_selected() {
    // step forwards through nodes and center display
    if (oreqm_main && selected_nodes.length) {
      if (selected_index > selected_nodes.length) selected_index = 0
      center_node(selected_nodes[selected_index])
      selected_index++
      if (selected_index >= selected_nodes.length) selected_index = 0
    }
  }

  function id_search(regex) {
    var results = oreqm_main.find_reqs_with_name(regex)
    set_selection(results)
    oreqm_main.clear_colors()
    oreqm_main.color_up_down(results, COLOR_UP, COLOR_DOWN)
    const graph = oreqm_main.create_graph(select_color, "reqspec1", construct_graph_title(true), results)
    set_doctype_count_shown(graph.doctype_dict, graph.selected_dict)
  }

  function txt_search(regex) {
    var results = oreqm_main.find_reqs_with_text(regex)
    selected_nodes = results
    selected_index = 0
    oreqm_main.clear_colors()
    oreqm_main.color_up_down(results, COLOR_UP, COLOR_DOWN)
    const graph = oreqm_main.create_graph(select_color, "reqspec1", construct_graph_title(true), results)
    set_doctype_count_shown(graph.doctype_dict, graph.selected_dict)
  }

  function clear_reference()
  {
    if (oreqm_ref) {
      oreqm_ref = null
      oreqm_main.remove_ghost_requirements(true)
      document.getElementById('ref_name').innerHTML = ''
      document.getElementById('ref_size').innerHTML = ''
      document.getElementById('ref_timestamp').innerHTML = ''
      if (auto_update) {
        filter_graph()
      }
    }
  }

  // Setup for the "about" dialog
  var aboutPane = document.getElementById("aboutPane");

  // Get the button that opens the modal
  var aboutButton = document.getElementById("aboutButton");

  // Get the <span> element that closes the modal
  var aboutPaneClose = document.getElementById("aboutPaneClose");

  // When the user clicks the button, open the modal
  aboutButton.onclick = function() {
    aboutPane.style.display = "block";
  }

  // When the user clicks on <span> (x), close the modal
  aboutPaneClose.onclick = function() {
    aboutPane.style.display = "none";
  }

  // Setup for the raw node display dialog (raw text and diff (for changed reqs))
  var nodeSource = document.getElementById("nodeSource");

  // Get the <span> element that closes the modal
  var nodeSourceClose = document.getElementById("nodeSourceClose");

  function show_raw_node() {
    nodeSource.style.display = "block";
  }

  // When the user clicks on <span> (x), close the modal
  nodeSourceClose.onclick = function() {
    nodeSource.style.display = "none";
  }

  // When the user clicks anywhere outside of the modal, close it
  window.onbeforeunload = function(event) {
    return //"Graph is going away..."
  }

  // When the user clicks anywhere outside one of the modal dialogs, close it
  window.onclick = function(event) {
    if (event.target == aboutPane) {
      aboutPane.style.display = "none";
    } else if (event.target == nodeSource) {
      nodeSource.style.display = "none";
    }
  }

  // Selection/deselection of nodes by right-clicking the diagram

  function select_node() {
    // Add node to the selection criteria (if not already selected)
    let node = selected_node
    let node_select_str = "{}$".format(node)
    let search_pattern = document.getElementById("search_regex").value.trim()
    if (oreqm_main && oreqm_main.check_node_id(node)) {
      if (!search_pattern.includes(node_select_str)) {
        if (search_pattern.length) {
          node_select_str = '\n|'+node_select_str
        }
        search_pattern += node_select_str
        //document.querySelector("#id_checkbox input").checked = true
        document.getElementById("search_regex").value = search_pattern
        filter_change()
      }
    }
  }

  function deselect_node() {
    // Remove node to the selection criteria (if not already selected)
    let node = selected_node
    let node_select_str = new RegExp("(^|\\|){}\\$".format(node))
    let org_search_pattern = document.getElementById("search_regex").value.trim()
    let search_pattern = org_search_pattern.replace(/\n/g, '')
    let new_search_pattern = search_pattern.replace(node_select_str, '')
    if (new_search_pattern[0] === '|') {
      new_search_pattern = new_search_pattern.slice(1)
    }
    new_search_pattern = new_search_pattern.replace(/\|/g, '\n|')
    if (new_search_pattern !== search_pattern) {
      document.getElementById("search_regex").value = new_search_pattern
      //console.log("deselect_node() - search ", node, search_pattern, new_search_pattern)
      filter_change()
    } else {
      let alert_text = "'{}' is not a selected node\nPerhaps try 'Exclude'?".format(node)
      alert(alert_text)
    }
  }

  function exclude_node() {
    // Add node to the exclusion list
    if (oreqm_main && oreqm_main.check_node_id(selected_node)) {
        var excluded_ids = document.getElementById("excluded_ids").value.trim()
      if (excluded_ids.length) {
        excluded_ids += '\n' + selected_node
      } else {
        excluded_ids = selected_node
      }
      document.getElementById("excluded_ids").value = excluded_ids
      filter_change()
    }
  }

  function clear_search_regex() {
    document.getElementById("search_regex").value = ""
    filter_change()
  }

  function clear_excluded_ids() {
    document.getElementById("excluded_ids").value = ""
    filter_change()
  }

  function center_node(node_name) {
    // Grab all the siblings of the element that was actually clicked on
    let found = false
    let titles = document.querySelectorAll('.node > title');
    let bb
    let node
    for (node of titles ) {
      if (node.innerHTML === node_name) {
        found = true
        bb = node.parentNode.getBBox()
        // console.log("BBox", bb, node_name)
        break;
      }
    }
    if (found) {
      set_selection_highlight(node.parentNode)
      let output = document.getElementById("output");
      let sizes = panZoom.getSizes()
      let rz = sizes.realZoom;
      //let pan = panZoom.getPan()
      let window_width = output.clientWidth/rz
      let window_height = output.clientHeight/rz
      let req_center_x = bb.x + bb.width * 0.5
      let req_center_y = bb.y
      //console.log("Sizes", sizes)
      //console.log("ViewBox", sizes.viewBox)
      //console.log("Pan", pan)

      let centerpos_x = sizes.viewBox.width * 0.5
      let centerpos_y = sizes.viewBox.height * 0.5
      if (window_width > sizes.viewBox.width) {
        centerpos_x += (window_width-sizes.viewBox.width) * 0.5
      }
      if (window_width < sizes.viewBox.width) {
        centerpos_x -= (sizes.viewBox.width-window_width) * 0.5
      }
      if (window_height > sizes.viewBox.height) {
        //centerpos_y += (window_height-sizes.viewBox.height) * 0.5
        req_center_y -= (window_height-sizes.viewBox.height) * 0.5
      }
      if (window_height < sizes.viewBox.height) {
        centerpos_y -= (sizes.viewBox.height-window_height) * 0.5
      }
      // console.log(centerpos_x, centerpos_y)
      let pan_vector_x = (centerpos_x - req_center_x)*rz
      let pan_vector_y = (centerpos_y - req_center_y)*rz
      // console.log(pan_vector_x, pan_vector_y)
      panZoom.pan({x: pan_vector_x, y: pan_vector_y*0.5});
    }
  }

  // drop file handling
  const drop_area_main = document.getElementById('drop_area_main');
  const drop_area_ref = document.getElementById('drop_area_ref');

  // Prevent default drag behaviors
  ;['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    drop_area_main.addEventListener(eventName, preventDefaults, false)
    drop_area_ref.addEventListener(eventName, preventDefaults, false)
    document.body.addEventListener(eventName, preventDefaults, false)
  })

  // Highlight drop area when item is dragged over it
  ;['dragenter', 'dragover'].forEach(eventName => {
    drop_area_main.addEventListener(eventName, highlight_main, false)
    drop_area_ref.addEventListener(eventName, highlight_ref, false)
  })

  ;['dragleave', 'drop'].forEach(eventName => {
    drop_area_main.addEventListener(eventName, unhighlight_main, false)
    drop_area_ref.addEventListener(eventName, unhighlight_ref, false)
  })

  drop_area_main.addEventListener('drop', (event) => {
    event.stopPropagation();
    event.preventDefault();
    const fileList = event.dataTransfer.files;
    //console.log(fileList);
    process_dropped_file(event, true)
  });

  drop_area_ref.addEventListener('drop', (event) => {
    event.stopPropagation();
    event.preventDefault();
    const fileList = event.dataTransfer.files;
    //console.log(fileList);
    process_dropped_file(event, false)
  });

  function preventDefaults (e) {
    e.preventDefault()
    e.stopPropagation()
  }

  function highlight_main(e) {
    drop_area_main.classList.add('highlight')
  }

  function highlight_ref(e) {
    if (oreqm_main) {
      drop_area_ref.classList.add('highlight')
    }
  }

  function unhighlight_main(e) {
    drop_area_main.classList.remove('highlight')
  }

  function unhighlight_ref(e) {
    drop_area_ref.classList.remove('highlight')
  }

  // Main oreqm file
  drop_area_main.addEventListener('dragover', (event) => {
    event.stopPropagation();
    event.preventDefault();
    // Style the drag-and-drop as a "copy file" operation.
    event.dataTransfer.dropEffect = 'copy';
  });

  // Reference oreqm file
  drop_area_ref.addEventListener('dragover', (event) => {
    event.stopPropagation();
    event.preventDefault();
    // Style the drag-and-drop as a "copy file" operation.
    if (oreqm_main) {
      event.dataTransfer.dropEffect = 'copy';
    } else {
      event.dataTransfer.dropEffect = 'none';
    }
  });

  document.addEventListener('dragover', (event) => {
    event.stopPropagation();
    event.preventDefault();
    event.dataTransfer.dropEffect = 'none';
  });

  function process_dropped_file(ev, main_file) {
    // Process dropped file, if there is just one file
    let dropped_file
    let count = 0
    if (ev.dataTransfer.items) {
      // Use DataTransferItemList interface to access the file(s)
      for (var i = 0; i < ev.dataTransfer.items.length; i++) {
        // If dropped items aren't files, reject them
        if (ev.dataTransfer.items[i].kind === 'file') {
          count++
          var file = ev.dataTransfer.items[i].getAsFile();
          //console.log('... file[' + i + '].name = ' + file.name);
          dropped_file = file
        }
      }
    } else {
      // Use DataTransfer interface to access the file(s)
      for (var i = 0; i < ev.dataTransfer.files.length; i++) {
        //console.log('... file[' + i + '].name = ' + ev.dataTransfer.files[i].name);
        dropped_file = ev.dataTransfer.files[i]
        count++
      }
    }
    if (count === 1) {
      if (main_file) {
        load_file_main(dropped_file)
      } else {
        load_file_ref(dropped_file)
      }
    }
  }

  function show_doctypes() {
    // Show the graph of doctype relationships
    if (oreqm_main) {
      const graph = oreqm_main.doctype_graph()
      updateGraph();
    }
  }

  function xml_escape(txt) {
    return txt.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  function show_source() {
    // Show selected node as XML
    if (selected_node.length) {
      var ref = document.getElementById('req_src');
      if (oreqm_ref && oreqm_main.updated_reqs.includes(selected_node)) {
        // create a diff
        let text_ref = xml_escape(oreqm_ref.get_node_text_formatted(selected_node))
        let text_main = xml_escape(oreqm_main.get_node_text_formatted(selected_node))
        let result = '<h2>XML format (changed specobject)</h2><pre>'
        let diff = Diff.diffLines(text_ref, text_main)
        diff.forEach(function(part){
          // green for additions, red for deletions, black for common parts
          let color = part.added ? 'green' : part.removed ? 'red' : 'grey';
          let font = 'normal'
          if (part.added || part.removed) {
            font = 'bold'
          }
          result += '<span style="color: {}; font-weight: {};">{}</span>'.format(color, font, part.value)
        });
        result += '</pre>'
        ref.innerHTML = result
      } else {
        let header_main = "<h2>XML format</h2>"
        if (oreqm_main.removed_reqs.includes(selected_node)) {
          header_main = "<h2>XML format (removed specobject)</h2>"
        } else if (oreqm_main.new_reqs.includes(selected_node)) {
          header_main = "<h2>XML format (new specobject)</h2>"
        }
        ref.innerHTML = '{}<pre>{}</pre>'.format(header_main, xml_escape(oreqm_main.get_node_text_formatted(selected_node)))
      }
      nodeSource.style.display = "block";
    }
  }
