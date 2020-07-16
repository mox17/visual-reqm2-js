// Manage color palettes for doctypes

function hsv_to_rgb(hue, saturation, value) {
  // HSV values in [0..1]
  //  returns [r, g, b] values from 0 to 255
  let hue_int = Math.floor(hue * 6)
  let f = hue * 6 - hue_int
  let p = value * (1 - saturation)
  let q = value * (1 - f * saturation)
  let t = value * (1 - (1 - f) * saturation)
  if (hue_int === 0) {
    red = value
    green = t
    blue = p
  }
  if (hue_int === 1) {
    red = q
    green = value
    blue = p
  }
  if (hue_int === 2) {
    red = p
    green = value
    blue = t
  }
  if (hue_int === 3) {
    red = p
    green = q
    blue = value
  }
  if (hue_int === 4) {
    red = t
    green = p
    blue = value
  }
  if (hue_int === 5) {
    red = value
    green = p
    blue = q
  }
  return [Math.floor(red * 256), Math.floor(green * 256), Math.floor(blue * 256)]
}

// use golden ratio
const GOLDEN_RATIO_CONJUGATE = 0.618033988749895
var HUE_START = 0.314159265359 // use "random" start value
var HUE = 0.314159265359 // use "random" start value

function get_random_color() {
  // Calculate next pseudo random color
  HUE += GOLDEN_RATIO_CONJUGATE
  HUE %= 1
  return hsv_to_rgb(HUE, 0.3, 0.99)
}

function _color_random_reset() {
  HUE = HUE_START
}

function decimalToHex(d, padding) {
  var hex = Number(d).toString(16).toUpperCase();
  padding = typeof (padding) === "undefined" || padding === null ? padding = 2 : padding;

  while (hex.length < padding) {
      hex = "0" + hex;
  }
  return hex;
}

function get_color_string() {
  // Return color as #RRGGBB string"""
  color = get_random_color()
  return "#{}{}{}".format(decimalToHex(color[0], 2),
                          decimalToHex(color[1], 2),
                          decimalToHex(color[2], 2))
}

function get_color_array(size) {
  // Return a list with size number of #RRGGBB string colors
  let color_array = []
  for (const i = 0; i<size; i++) {
    color = get_color_string()
    color_array.push(color)
  }
  return color_array
}

function add_color(palette, doctype) {
  let doctypes = Object.keys(palette)
  let new_color = get_color_string()
  while (true) {
    for (const dt of doctypes) {
      if (new_color === palette[dt]) {
        new_color = get_color_string()
        continue
      }
    }
    break;
  }
  palette[doctype] = new_color
  return new_color
}

  var my_palette =
  {
    "none": "#FFFFFF"
  };

  function get_color(key) {
    if (key in my_palette) {
      color = my_palette[key]
    } else {
      color = add_color(my_palette, key)
    }
    return color
  }


  function downloadObjectAsJson(exportObj, exportName){
    var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj, 0, 2));
    var downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", exportName + ".json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }

  function save_colors() {
    // Download color object and store it in Web storage
    downloadObjectAsJson(my_palette, "visual_reqm2_colors")
    store_colors(my_palette)
  }

  function load_colors() {
    let input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json'

    input.onchange = e => {
      const file = e.target.files[0];
      let reader = new FileReader();

      reader.readAsText(file,'UTF-8');
      reader.onload = readerEvent => {
        const colors = JSON.parse(readerEvent.target.result);
        store_colors(colors)
        //console.log(colors)
        my_palette = colors
        _color_random_reset()
        update_doctype_table()
      }
    }
    input.click();
  }

  const color_storage_name = 'Visual_ReqM2_color_palette'
  function store_colors(colors) {
    if (typeof(Storage) !== "undefined") {
      const color_string = JSON.stringify(colors)
      localStorage.setItem(color_storage_name, color_string);
    }
  }

  // Load color palette when page loads
  if (typeof(Storage) !== "undefined") {
    // Code for localStorage/sessionStorage.
    let color_string = localStorage.getItem(color_storage_name);
    //console.log("storage:", color_string, typeof(color_string))
    if (typeof(color_string) === 'string') {
      const colors = JSON.parse(color_string)
      my_palette = colors
    }
  } else {
    // Sorry! No Web Storage support..
  }
