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

function _color_reset() {
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
    "assumptions": "#FF8000",
    "creq": "#FDB1D0",
    "faou": "#FFE6CC",
    "fea": "#B1E6FD",
    "hazop": "#DC8AFF",
    "hw_featurespec": "#FFCC99",
    "hw_safetydocs": "#FFC95E",
    "impl": "#B0B5FF",
    "kernelconf": "#E828EF",
    "kernelconfspec": "#9999FF",
    "kernelconfts": "#E5CCFF",
    "nonfunctional": "#F838FF",
    "pdoc": "#CEB1FD",
    "preq": "#FCFDB1",
    "reqspec1": "#00CC66",
    "reqspec2": "#00BB00",
    "review": "#FFCCFF",
    "safetymandoc": "#B35900",
    "saou": "#FFB685",
    "swad": "#99FF99",
    "swdd": "#E08F97",
    "swdda": "#FFA3AC",
    "swddats": "#EEFFB5",
    "swintts": "#CCCC00",
    "swrs": "#00DD00",
    "swts": "#BBBB11",
    "swuts": "#FFFF33",
    "systemfunction": "#A5CFA5",
    "udoc": "#D3FDB1"
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
    downloadObjectAsJson(my_palette, "visual_reqm2_colors")
  }

  function load_colors() {
    let input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json'

    input.onchange = e => {
      let file = e.target.files[0];
      let reader = new FileReader();

      reader.readAsText(file,'UTF-8');
      reader.onload = readerEvent => {
        colors = JSON.parse(readerEvent.target.result);
        //console.log(colors)
        my_palette = colors
        update_doctype_table()
      }
    }
    input.click();
  }
