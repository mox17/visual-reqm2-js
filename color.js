// Manage color palettes for doctypes

  var my_palette =
  {
    "assumptions": "#FF8000",
    "creq": "#FDB1D0",
    "faou": "#FFE6CC",
    "fea": "#B1E6FD",
    "hazop": "#DC8AFF",
    "hw_featurespec": "#FFCC99",
    "hw_safetydocs": "#FFC95E",
    "impl": "#7075FF",
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
    color = 'wheat'
    if (key in my_palette) {
      color = my_palette[key]
    }
    return color
  }

