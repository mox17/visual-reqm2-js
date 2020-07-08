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

function stringEqual(a, b) {
  const a_s = JSON.stringify(a)
  const b_s = JSON.stringify(b)
  return a_s === b_s
}

function get_xml_text(node, tag_name) {
  var result = ""
  var item = node.getElementsByTagName(tag_name)
  if (item.length > 0) {
    result = item[0].textContent
  }
  return result
}

function get_list_of(node, tag_name) {
  var result = []
  var items = node.getElementsByTagName(tag_name)
  var i;
  for (i=0; i < items.length; i++) {
    result.push(items[i].textContent)
  }
  return result
}

function get_fulfilledby(node) {
  //Return a list of arrays (id,doctype,version) of the ffbObj's
  var ff_list = []
  var ffbobj_list = node.getElementsByTagName('ffbObj')
  var i;
  for (i = 0; i < ffbobj_list.length; i++) {
    var ffbobj = ffbobj_list[i]
    var ff_entry = []
    ff_entry[0] = get_xml_text(ffbobj, 'ffbId')
    ff_entry[1] = get_xml_text(ffbobj, 'ffbType')
    ff_entry[2] = get_xml_text(ffbobj, 'ffbVersion')
    ff_list.push(ff_entry)
  }
  return ff_list
}

function dot_format(txt) {
  //Remove xml style formatting not compliant with dot
  const re_xml_comments = new RegExp(/<!--.*?-->/g, 'm')
  const re_unwanted_mu  = new RegExp(/<!\[CDATA\[\s*/g, 'm')
  const re_amp_quote    = new RegExp(/&/g, 'm')
  const re_list_heurist = new RegExp(/<li>[\s\n]*|<listitem>[\s\n]*/g, 'm')
  const re_tag_text     = new RegExp(/<a\s+type="xref"\s+href="[A-Z]+_([^"]+)"\s*\/>/g, 'm')
  const re_newlines     = new RegExp(/<br\/>|<BR\/>/g, 'm')
  const re_xml_remove   = new RegExp(/<\S.*?>/g, 'm')
  const re_whitespace   = new RegExp(/^[\s\n]*|\s\n]*$/)
  const re_nbr_list     = new RegExp(/\n\s+(\d+)/g)
  const re_line_length  = new RegExp(/([^\n]{90,500}?(;| ))/g)
  const re_keep_nl      = new RegExp(/\s*\n\s*/)
  const re_empty_lines  = new RegExp(/<BR ALIGN="LEFT"\/>(&nbsp;<BR ALIGN="LEFT"\/>)+/, 'm')

  let new_txt = ''
  if (txt.length) {
    txt = txt.replace(re_xml_comments, '') // remove XML comments
    txt = txt.replace(re_unwanted_mu, '')  // Remove unwanted markup
    txt = txt.replace(re_amp_quote, '&amp;')        // escape stray '&' characters
    //new_txt = txt.replace(re_list_heurist, '&nbsp;&nbsp;* ') // heuristic for bulleted lists
    new_txt = txt.split(/<li>[\s\n]*|<listitem>[\s\n]*/).join('&nbsp;&nbsp;* ') // heuristic for bulleted lists
    // Dig out meaningful text from items like:
    // <a type="xref" href="TERM_UNAUTHORIZED_EXECUTABLE_ENTITIES"/>
    new_txt = new_txt.replace(re_tag_text, '$1')
    new_txt = new_txt.split(/<br\/>|<BR\/>/).join('&nbsp;\n') // keep deliberate newlines
    new_txt = new_txt.split(/<\S.*?>/).join('') // remove xml markup
    new_txt = new_txt.replace(re_whitespace, '') // remove leading and trailing whitespace
    new_txt = new_txt.replace(/"/g, '&quot;')
    new_txt = new_txt.replace(/</g, '&lt;')
    new_txt = new_txt.replace(/>/g, '&gt;')
    new_txt = new_txt.replace(re_nbr_list, '\n&nbsp;&nbsp;$1') // heuristic for numbered lists
    new_txt = new_txt.replace(re_line_length, '$1\n') // limit line length
    new_txt = new_txt.split(/\s*\n\s*/).join('<BR ALIGN="LEFT"/>') // preserve newlines
    new_txt = new_txt.replace(re_empty_lines, '<BR ALIGN="LEFT"/>&nbsp;<BR ALIGN="LEFT"/>') // Limit empty lines
    if (!new_txt.endsWith('<BR ALIGN="LEFT"/>')) {
      new_txt += '<BR ALIGN="LEFT"/>'
    }
  }
  return new_txt
}

function format_edge(from_node, to_node, kind) {
  // Format graph edge according to coverage type
  let formatting = ""
  if (kind == "fulfilledby") {
    formatting = ' [style=bold color=purple dir=back fontname="Arial" label="ffb"]'
  }
  return '  "{}" -> "{}"{};\n'.format(from_node, to_node, formatting)
}

function tags_line(tags, platforms) {
  // Combine tags and platforms into one cell in table
  let line = []
  if (tags.length) {
    let tag_str = "tags: " + tags.join(", ")
    tag_str = tag_str.replace(/([^\n]{90,110})/g, '$1,<BR ALIGN="LEFT"/>')
    line.push(tag_str)
  }
  if (platforms.length) {
    let platform_str = "platforms: " + platforms.join(", ")
    platform_str = platform_str.replace(/([^\n]{90,110})/g, '$1,<BR ALIGN="LEFT"/>')
    line.push(platform_str)
  }
  if (line.length) {
    return line.join('<BR ALIGN="LEFT"/>')
  } else {
    return ""
  }
}

function format_node(node_id, rec) {
  // Create 'dot' style 'html' table entry for the specobject. Rows without data are left out
  let node_table = ""
  let furtherinfo = ""
  let safetyrationale = ""
  let shortdesc = ""
  let rationale = ""
  let verifycrit = ""
  let comment = ""
  let source = ""
  let status = ""
  if (rec.furtherinfo)     {furtherinfo     = '        <TR><TD COLSPAN="3" ALIGN="LEFT">furtherinfo: {}</TD></TR>\n'.format(dot_format(rec.furtherinfo));}
  if (rec.safetyrationale) {safetyrationale = '        <TR><TD COLSPAN="3" ALIGN="LEFT">safetyrationale: {}</TD></TR>\n'.format(dot_format(rec.safetyrationale));}
  if (rec.shortdesc)       {shortdesc       = '        <TR><TD COLSPAN="3" ALIGN="LEFT">shortdesc: {}</TD></TR>\n'.format(dot_format(rec.shortdesc));}
  if (rec.rationale)       {rationale       = '        <TR><TD COLSPAN="3" ALIGN="LEFT">rationale: {}</TD></TR>\n'.format(dot_format(rec.rationale));}
  if (rec.verifycrit)      {verifycrit      = '        <TR><TD COLSPAN="3" ALIGN="LEFT">{}</TD></TR>\n'.format(dot_format(rec.verifycrit));}
  if (rec.comment)         {comment         = '        <TR><TD COLSPAN="3" ALIGN="LEFT">comment: {}</TD></TR>\n'.format(dot_format(rec.comment));}
  if (rec.source)          {source          = '        <TR><TD COLSPAN="3" ALIGN="LEFT">source: {}</TD></TR>\n'.format(dot_format(rec.source));}
  if (rec.status)          {status          = '        <TR><TD>{}</TD><TD>{}</TD><TD>{}</TD></TR>\n'.format(tags_line(rec.tags, rec.platform), rec.safetyclass, rec.status);}
  node_table     = `
      <TABLE BGCOLOR="{}" BORDER="1" CELLSPACING="0" CELLBORDER="1" >
        <TR><TD CELLSPACING="0" >{}</TD><TD>{}</TD><TD>{}</TD></TR>
        <TR><TD COLSPAN="2" ALIGN="LEFT">{}</TD><TD>{}</TD></TR>\n{}{}{}{}{}{}{}{}      </TABLE>`.format(
                        get_color(rec.doctype),
                        node_id, rec.version, rec.doctype,
                        dot_format(rec.description), rec.needsobj.join('<BR/>'),
                        shortdesc,
                        rationale,
                        safetyrationale,
                        verifycrit,
                        comment,
                        furtherinfo,
                        source,
                        status)
  let node = '  "{}" [label=<{}>];\n'.format(node_id, node_table)
  return node
}

// some ways to select a subset of specobjects
function select_all(node_id, rec, node_color) {
  // Select all - no need to inspect input
  return true
}

function select_some(node_id, rec, node_color) {
  // A random heuristic to select a subset of nodes
  return ['kernelconf'].includes(rec.doctype)
}

var SELECTED_DOCTYPES = []

function select_doctype(node_id, rec, node_color) {
  // Select based on doctype
  return SELECTED_DOCTYPES.includes(rec.doctype)
}

const COLOR_UP = 1
const COLOR_DOWN = 2

function select_color(node_id, rec, node_color) {
  // Select colored nodes
  return node_color.has(COLOR_UP) || node_color.has(COLOR_DOWN)
}

function compare_oreqm() {
  // Both main and reference oreqm have been read.
  // Highlight new and changed nodes in main oreqm
  let results = oreqm_main.compare_requirements(oreqm_ref)
  console.log(results)
  oreqm_main.color_up_down(results[0], COLOR_UP, COLOR_DOWN)
  oreqm_main.color_up_down(results[1], COLOR_UP, COLOR_DOWN)
  let ref_title = title
  ref_title += "\\lReference oreqm: '{}' from: {}\\l".format(oreqm_ref_filename, oreqm_ref_timestamp)
  ref_title += "\\lNew requirements are:\\l - {}\\l".format(results[0].join("\\l - "))
  ref_title += "\\lUpdated requirements are:\\l - {}\\l".format(results[1].join("\\l - "))
  const all_highlight = results[0].concat(results[1])
  graph = oreqm_main.create_graph(select_color, "reqspec1", ref_title, all_highlight)
}

