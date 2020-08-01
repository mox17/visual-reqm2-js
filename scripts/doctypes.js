/* class for calculating doctype relationships */
"use strict";

class Doctype {
  // This class represent what relationships a doctype has
  constructor(name) {
    this.name = name
    this.count = 0               // Number of instances
    this.needsobj = new Map()    // doctype : [id]
    this.fulfilledby = new Map() // doctype : [id]
    this.linksto = new Map()     // doctype : [id]
    this.id_list = []            // [id]
  }

  add_instance(id) {
    this.count++
    this.id_list.push(id)
  }

  add_needsobj(doctype) {
    if (this.needsobj.has(doctype)) {
      let count = this.needsobj.get(doctype)
      this.needsobj.set(doctype, count+1)
    } else {
      this.needsobj.set(doctype, 1)
    }
  }

  add_linksto(doctype, id) {
    if (this.linksto.has(doctype)) {
      //let count = this.linksto.get(doctype)
      //this.linksto.set(doctype, count+1)
      this.linksto.get(doctype).push(id)
    } else {
      this.linksto.set(doctype, [id])
    }
  }

  add_fulfilledby(doctype, id) {
    if (this.fulfilledby.has(doctype)) {
      //let count = this.fulfilledby.get(doctype)
      //this.fulfilledby.set(doctype, count+1)
      this.fulfilledby.get(doctype).push(id)
    } else {
      this.fulfilledby.set(doctype, [id])
    }
  }

}