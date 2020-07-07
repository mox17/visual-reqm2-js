/* class for calculating doctype relationships */
"use strict";

class Doctype {
  // This class represent what relationships a doctype has
  constructor(name) {
    this.name = name
    this.count = 0               // Number of instances
    this.needsobj = new Map()    // doctype : count
    this.fulfilledby = new Map() // doctype : count
    this.linksto = new Map()     // doctype : count
  }

  add_instance() {
    this.count++
  }

  add_needsobj(doctype) {
    if (this.needsobj.has(doctype)) {
      let count = this.needsobj.get(doctype)
      this.needsobj.set(doctype, count+1)
    } else {
      this.needsobj.set(doctype, 1)
    }
  }

  add_linksto(doctype) {
    if (this.linksto.has(doctype)) {
      let count = this.linksto.get(doctype)
      this.linksto.set(doctype, count+1)
    } else {
      this.linksto.set(doctype, 1)
    }
  }

  add_fulfilledby(doctype) {
    if (this.fulfilledby.has(doctype)) {
      let count = this.fulfilledby.get(doctype)
      this.fulfilledby.set(doctype, count+1)
    } else {
      this.fulfilledby.set(doctype, 1)
    }
  }

}