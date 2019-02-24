var quanto_options = {
  originX: 500,
  originY: 300,
  scale: 30
}

function Transformer() {
  var that = this;
  var ninety = true;
  this.scale = quanto_options.scale;

  this.toScreenX = function (c) {
    return quanto_options.originX + (c * that.scale);
  }

  this.toScreenY = function (c) {
    return quanto_options.originY + (c * that.scale);
  }
  this.toScreenZ = function (c) {
    return quanto_options.originZ + (c * that.scale);
  }

  this.toScreen = function (coord) {
    if (ninety) {
      return [that.toScreenX(coord[1]),
      that.toScreenY(coord[0]),
      that.toScreenZ(0)]
    } else {
      return [that.toScreenX(0),
      that.toScreenY(coord[0]),
      that.toScreenZ(coord[1])]
    }
  }

  this.scaleToScreen = function (l) {
    return l * that.scale;
  }

  return this;
}

function Theory(name, thyJson) {
  var that = this;
  this.json = thyJson;
  this.name = name;

  this.typ = function (n) {
    if (n.data == null) return that.json.default_vertex_type;
    else return n.data.type;
  }

  this.shape = function (n) {
    return that.json.vertex_types[that.typ(n)].style.shape;
  }

  this.fill = function (n) {
    var col = that.json.vertex_types[that.typ(n)].style.fill_color;
    return d3.rgb(255 * col[0], 255 * col[1], 255 * col[2]);
  }

  this.stroke = function (n) {
    var col = that.json.vertex_types[that.typ(n)].style.stroke_color;
    return d3.rgb(255 * col[0], 255 * col[1], 255 * col[2]);
  }

  this.val = function (n) {
    if (n.data == null) {
      return that.json.vertex_types[that.json.default_vertex_type]
        .default_data.value;
    } else {
      if (n.data.value == null) {
        return that.json.vertex_types[n.data.type]
          .default_data.value;
      } else {
        return n.data.value;
      }
    }
  }

  return this;
}

function Graph(graphJson) {
  var that = this;
  this.json = graphJson;
  this.nodeVertices = d3.map(graphJson.node_vertices);
  this.wireVertices = d3.map(graphJson.wire_vertices);
  this.undirEdges = d3.map(graphJson.undir_edges);
  this.bangBoxes = d3.map(graphJson.bang_boxes);
  this.vertices = d3.set(
    this.nodeVertices.keys().concat(this.wireVertices.keys()));

  this.src = function (e) {
    var n = that.wireVertices.get(e.src);
    if (n != null) return n
    else return that.nodeVertices.get(e.src);
  };

  this.tgt = function (e) {
    var n = that.wireVertices.get(e.tgt);
    if (n != null) return n
    else return that.nodeVertices.get(e.tgt);
  };

  this.bboxFor = function (vs, wpad, npad) {
    var minX = null,
      maxX = null,
      minY = null,
      maxY = null;
    vs.forEach(function (vname) {
      var wire, v;
      if (that.nodeVertices.has(vname)) {
        wire = false;
        v = that.nodeVertices.get(vname);
      } else {
        wire = true;
        v = that.wireVertices.get(vname);
      }

      var pad = (wire) ? wpad : npad;
      var c = v.annotation.coord;
      minX = (minX == null) ? c[0] - pad : Math.min(c[0] - pad, minX);
      maxX = (maxX == null) ? c[0] + pad : Math.max(c[0] + pad, maxX);
      minY = (minY == null) ? c[1] - pad : Math.min(c[1] - pad, minY);
      maxY = (maxY == null) ? c[1] + pad : Math.max(c[1] + pad, maxY);
    });

    if (minX == null) {
      minX = -npad;
      maxX = npad;
      minY = -npad;
      maxY = npad;
    }

    return {
      minX: minX,
      maxX: maxX,
      minY: minY,
      maxY: maxY,
      midX: (minX + maxX) / 2,
      midY: (minY + maxY) / 2,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  this.bbox = function () {
    var wpad = 0.5;
    var npad = 2;
    return that.bboxFor(that.vertices, wpad, npad);
  }

  return this;
}

function Derivation(derJson) {
  var that = this;
  this.json = derJson;
  this.steps = [];
  var step = (derJson.heads.length > 0) ? derJson.heads[0] : null;
  while (step != null) {
    this.steps.push({
      graph: new Graph(derJson.steps[step].graph),
      ruleName: derJson.steps[step].rule_name
    });
    step = derJson.steps[step].parent;
  }
  this.steps.reverse();
  this.root = new Graph(derJson.root);
}


function drawGraph(trans, thy, graph, svg, inserted, removed) {

  graph.bangBoxes.values().forEach(function (bb) {
    var wpad = 0.5;
    var npad = 0.5;
    var box = graph.bboxFor(bb.contents, wpad, npad);

    svg.append("a-box")
      .attr("position", "")
      .attr("color", "#DDD")
      .attr("material", "opacity: 0.7")
  });

  graph.undirEdges.values().forEach(function (e) {

    var sc = trans.toScreen(graph.src(e).annotation.coord);
    var tc = trans.toScreen(graph.tgt(e).annotation.coord);
    svg.append("a-entity")
      .attr("line", `start: ${sc[0]}  ${sc[1]} ${sc[2]};` +
        `end: ${tc[0]}  ${tc[1]} ${tc[2]};`
      )

    // <a-entity geometry="primitive: cylinder; height: 3; radius: 2"></a-entity>

  });

  graph.nodeVertices.forEach(function (k, v) {
    var nd;
    var c = trans.toScreen(v.annotation.coord);

    console.log(k)
    console.log(v)
    switch (thy.shape(v)) {
      case "circle":
        nd = svg.append("a-sphere")
          .attr("radius", 0.2);
        break;
      case "rectangle":
        nd = svg.append("a-box")
          .attr("height", "0.4")
          .attr("width", "0.4")
          .attr("depth", "0.4")
          .attr("quanto", true)
        break;
    }


    nd.attr("color", thy.fill(v));

    if (thy.val(v) != "" && thy.val(v) != null) {
      var label = texConstants(thy.val(v));
      var lText = svg.append("a-entity");

      lText.attr("x", c[0])
        .attr("y", c[1] + 4)
        .attr("text", "value: " + label)
    }

    var pad = 4;

    switch (thy.shape(v)) {
      case "circle":
        nd.attr("position", `${c[0]} ${c[1]} ${c[2]}`)
        break;
      case "rectangle":
        nd.attr("position", `${c[0]} ${c[1]} ${c[2]}`)
        break;
    }

  });
}

function addGraph(thy, graph, div, inserted, removed) {
  var trans = new Transformer();
  var bbox = graph.bbox();
  var width;
  var height;

  // fit width and height to svg element, if not specified
  if (div.node().style.width == "") {
    width = trans.scaleToScreen(bbox.width);
  } else {
    width = div.node().offsetWidth;
  }

  if (div.node().style.height == "") {
    height = trans.scaleToScreen(bbox.height);
  } else {
    height = div.node().offsetHeight;
  }

  trans.originX = width / 2 - trans.scaleToScreen(bbox.midX);
  trans.originY = height / 2 + trans.scaleToScreen(bbox.midY);

  drawGraph(trans, thy, graph, div, inserted, removed);
}

// var width = 1000,
//     height = 600;

// var color = d3.scale.category20();

// var force = d3.layout.force()
//     .charge(-120)
//     .linkDistance(30)
//     .size([width, height]);

function convertD3() {
  var theory = quanto_theory
  d3.json(theory, function (errorThy, thyJson) {
    var thyName = d3.select("meta[name=quanto-project]").attr("content");
    var thy = new Theory(thyName, thyJson);


    d3.selectAll(".qgraph")
      .each(function () {
        var div = d3.select(this);
        var jsonFile = thy.name + "/" + div.attr("data-src") + ".qgraph";
        d3.json(jsonFile, function (errorGr, graphJson) {
          addGraph(thy, new Graph(graphJson), div);
        });
      });

    d3.selectAll(".qrule")
      .each(function () {
        var div = d3.select(this);
        var jsonFile = thy.name + "/" + div.attr("data-src") + ".qrule";
        d3.json(jsonFile, function (errorGr, ruleJson) {
          var div1 = div.append("div").attr("class", "qgraph block");
          div.append("div")
            .attr("class", "block")
            .html("&nbsp;&nbsp;&nbsp;=&nbsp;&nbsp;&nbsp;");
          var div2 = div.append("div").attr("class", "qgraph block");

          if (div.attr("data-graph-width") != null) {
            div1.style("width", div.attr("data-graph-width"));
            div2.style("width", div.attr("data-graph-width"));
          }

          if (div.attr("data-graph-height") != null) {
            div1.style("height", div.attr("data-graph-height"));
            div2.style("height", div.attr("data-graph-height"));
          }

          addGraph(thy, new Graph(ruleJson.lhs), div1);
          addGraph(thy, new Graph(ruleJson.rhs), div2);
        });
      });

    d3.selectAll(".qderive")
      .each(function () {
        var div = d3.select(this);
        var jsonFile = thy.name + "/" + div.attr("data-src") + ".qderive";
        d3.json(jsonFile, function (errorGr, derJson) {
          var der = new Derivation(derJson);
          var bb = der.root.bbox();
          var maxWidth = bb.width;
          var maxHeight = bb.height;
          der.steps.forEach(function (step) {
            bb = step.graph.bbox();
            maxWidth = Math.max(maxWidth, bb.width);
            maxHeight = Math.max(maxHeight, bb.height);
          });
          console.log(maxHeight);
          var trans = new Transformer();
          trans.ninety = true;

          der.steps.forEach(function (step, i) {
            var b = d3.select("#scene")
              .append("a-box")
              .attr("position", `${2*i} 0 0`)
              .attr("rotation", `0 90 0`)
              .attr("material", `opacity: 0`)

            addGraph(thy, step.graph, b, null, null);
          })
          function setStep(index) {
            return function () {
              stepDisplay(current + 1)
              ruleDisplay(der.steps[index].ruleName)

              var removed = d3.set(lhs.vertices.values());
              rhs.vertices.forEach(function (v) {
                removed.remove(v);
              });
              var inserted = d3.set(rhs.vertices.values());
              lhs.vertices.forEach(function (v) {
                inserted.remove(v);
              });

              addGraph(thy, lhs, div1, null, removed);
              addGraph(thy, rhs, div2, inserted, null);
            }
          }
        });
      });
  });

}


function redraw() {
  d3.selectAll("*")[0].forEach(function (s) {
    if (d3.select(s).attr("quanto")) {
      d3.select(s).remove()
    }
  })
  convertD3()
}


function cameraShift() {
  d3.selectAll("a-entity")[0].forEach(function (s) {
    if (d3.select(s).attr("camera") !== null) {
      d3.select(s).attr("position", `${2*derivation_position} 0 3`)
    }
  })
}