
var requirements = new Map()

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
