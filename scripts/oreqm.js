// Some utility functions
"use strict";

String.prototype.format = function () {
  var i = 0, args = arguments;
  return this.replace(/{}/g, function () {
    return typeof args[i] != 'undefined' ? args[i++] : '';
  });
};

if (typeof(String.prototype.trim) === "undefined")
{
    String.prototype.trim = function()
    {
        return String(this).replace(/^\s+|\s+$/g, '');
    };
}

if (typeof(Array.prototype.remove) === "undefined")
{
  Array.prototype.remove = function() {
    var what, a = arguments, L = a.length, ax;
    while (L && this.length) {
        what = a[--L];
        while ((ax = this.indexOf(what)) !== -1) {
            this.splice(ax, 1);
        }
    }
    return this;
  };
}

RegExp.prototype.toJSON = function() { return this.source; };

// some ways to select a subset of specobjects
export function select_all(node_id, rec, node_color) {
  // Select all - no need to inspect input
  return true
}

const COLOR_UP = 1
const COLOR_DOWN = 2

export function select_color(node_id, rec, node_color) {
  // Select colored nodes
  return node_color.has(COLOR_UP) || node_color.has(COLOR_DOWN)
}

function compare_oreqm() {
  // Both main and reference oreqm have been read.
  // Highlight new, changed and removed nodes in main oreqm (removed are added as 'ghosts')
  let results = oreqm_main.compare_requirements(oreqm_ref)
  let new_search_array = []
  let raw_search = document.getElementById("search_regex").value.trim()
  // This is a hack, these prefixes are a hidden part of 'delta' reqs <id>, and a search term is constructed to find them
  // Also avoid adding them more than once.
  if (!raw_search.includes('new:')) new_search_array.push('new:')
  if (!raw_search.includes('chg:')) new_search_array.push('chg:')
  if (!raw_search.includes('rem:')) new_search_array.push('rem:')
  let new_search = new_search_array.join('|')
  if (new_search.length && raw_search) {
    raw_search = new_search + '|\n' + raw_search
  } else if (new_search.length) {
    raw_search = new_search
  }
  document.getElementById("search_regex").value = raw_search
  //console.log(results)
  const graph = oreqm_main.create_graph(select_color, "reqspec1", oreqm_main.construct_graph_title(true), [])
  set_doctype_count_shown(graph.doctype_dict, graph.selected_dict)
}
