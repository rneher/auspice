d3.select("body")
    .style("color", "black")
    .style("background-color", "white");

function depthFirstSearch(node) {
    if (typeof node.children != "undefined") {
	for (var i=0, c=node.children.length; i<c; i++) {
	    depthFirstSearch(node.children[i]);
	}
    }
}

function gatherTips(node, tips) {
    if (typeof node.children != "undefined") {
	for (var i=0, c=node.children.length; i<c; i++) {
	    gatherTips(node.children[i], tips);
	}
    }
    else {
	tips.push(node);
    }
    return tips;
}

function gatherInternals(node, internals) {
    if (typeof node.children != "undefined") {
	internals.push(node);
	for (var i=0, c=node.children.length; i<c; i++) {
	    gatherInternals(node.children[i], internals);
	}
    }
    return internals;
}

function setDates(internals) {
    internals.forEach(function (node) {
	tips = gatherTips(node, []);
	dates = []
	tips.forEach(function (tip) {
	    dates.push(tip.date);
	})
	node.date = d3.min(dates);
    })
}

function rainbow(numOfSteps, step) {
    // This function generates vibrant, "evenly spaced" colours (i.e. no clustering). 
    // This is ideal for creating easily distinguishable vibrant markers in Google Maps and other apps.
    // Adam Cole, 2011-Sept-14
    // HSV to RBG adapted from: http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript
    var r, g, b;
    var h = step / numOfSteps;
    var i = ~~(h * 6);
    var f = h * 6 - i;
    var q = 1 - f;
    switch(i % 6){
        case 0: r = 1, g = f, b = 0; break;
        case 1: r = q, g = 1, b = 0; break;
        case 2: r = 0, g = 1, b = f; break;
        case 3: r = 0, g = q, b = 1; break;
        case 4: r = f, g = 0, b = 1; break;
        case 5: r = 1, g = 0, b = q; break;
    }
    var c = "#" + ("00" + (~ ~(r * 255)).toString(16)).slice(-2) + ("00" + (~ ~(g * 255)).toString(16)).slice(-2) + ("00" + (~ ~(b * 255)).toString(16)).slice(-2);
    return (c);
}

function getVaccines(tips) {
    vaccineChoice = {};
    vaccineChoice['A/Fujian/411/2002'] = "2004-02-21";
    vaccineChoice['A/California/7/2004'] = "2005-02-21";	
    vaccineChoice['A/Wisconsin/67/2005'] = "2006-02-21";		
    vaccineChoice['A/Brisbane/10/2007'] = "2008-02-21";
    vaccineChoice['A/Perth/16/2009'] = "2010-02-21";
    vaccineChoice['A/Victoria/361/2011'] = "2012-02-21";
    vaccineChoice['A/Texas/50/2012'] = "2014-02-21";	
    vaccineChoice['A/Switzerland/9715293/2013'] = "2014-09-25";
    vaccineStrains = Object.keys(vaccineChoice);
    vaccines = [];
    tips.forEach(function (tip) {
	if (vaccineStrains.indexOf(tip.strain) != -1) {
	    tip.date = vaccineChoice[tip.strain];
	    vaccines.push(tip);
	}
    })
    return vaccines;
}

function setFrequencies(node) {
    if (typeof node.frequency == "undefined") {
	node.frequency = 0.01;
    }
    if (typeof node.children != "undefined") {
	for (var i=0, c=node.children.length; i<c; i++) {
	    setFrequencies(node.children[i]);
	}
    }
}

function calcGeoDistribution(node, regions){
    node.geodis = {}
    for (var i=0;i<regions.length; i++){node.geodis[regions[i]]=0;}
    if (typeof node.children != "undefined") {
	for (var i=0; i<node.children.length; i++) {
	    calcGeoDistribution(node.children[i],regions);
	    for (var j=0;j<regions.length; j++){
		node.geodis[regions[j]]+=node.children[i].geodis[regions[j]];
	    }
	}
    }else if (node.alive){
	node.geodis[node.region]+=1;
    }
};

function calcBranchLength(node){
    if (typeof node.children != "undefined") {
	for (var i=0, c=node.children.length; i<c; i++) {
	    calcBranchLength(node.children[i]);
	    node.children[i].branch_length = node.children[i].xvalue-node.xvalue;
	}
    }
};

function setNodeAlive(node){
    if (typeof node.children != "undefined") {
	for (var i=0, c=node.children.length; i<c; i++) {
	    setNodeAlive(node.children[i]);
	}
    }
    node.alive = (node.dateval<dateCutoff)?true:false;
};

function calcUpPolarizers(node){
    node.up_polarizer = 0;
    if (node.alive){
	if (typeof node.children != "undefined") {
	    for (var i=0; i<node.children.length; i++) {
		calcUpPolarizers(node.children[i]);
		node.up_polarizer += node.children[i].up_polarizer;
	    }
	}
        bl =  node.branch_length/LBItau;
        node.up_polarizer *= Math.exp(-bl);
        node.up_polarizer += LBItau*(1-Math.exp(-bl));
    }
};    

function calcDownPolarizers(node){
    if (typeof node.children != "undefined") {
	for (var i1=0; i1<node.children.length; i1++) {
	    if (node.children[i1].alive){
		node.children[i1].down_polarizer = node.down_polarizer;
		for (var i2=0; i2<node.children.length; i2++) {
		    if (i1!=i2){
			node.children[i1].down_polarizer += node.children[i2].up_polarizer;
		    }
		}
		bl =  node.children[i1].branch_length/LBItau;
		node.children[i1].down_polarizer *= Math.exp(-bl);
		node.children[i1].down_polarizer += LBItau*(1-Math.exp(-bl));
		calcDownPolarizers(node.children[i1]);
	    }else{node.children[i1].down_polarizer=0;}
	}
    }
};

function calcPolarizers(node){
    calcUpPolarizers(node);
    node.down_polarizer = 0;
    calcDownPolarizers(node);    
};

function calcLBI(node, allnodes){
    console.log("Calculating LBI for date cutoff "+dateCutoff);
    calcPolarizers(node);
    allnodes.forEach(function (d) {
	d.LBI=0;
	if (d.alive){
	    d.LBI+=d.down_polarizer;
	    if (typeof d.children != "undefined") {
		for (var i=0; i<d.children.length; i++) {
		    d.LBI += d.children[i].up_polarizer;
		}
	    }
	}
    });
};

function calc_deltaLBI(node, allnodes, logdelta){
    console.log("Calculating deltaLBI for date cutoff "+dateCutoff);
    dateCutoff.setDate(dateCutoff.getDate()-deltaLBI_boundary_layer);
    setNodeAlive(node);
    calcLBI(node, allnodes);
    allnodes.forEach(function (d){d.delta_LBI = -d.LBI;});
    dateCutoff.setDate(dateCutoff.getDate()+deltaLBI_boundary_layer);
    setNodeAlive(node);
    calcLBI(node, allnodes);
    allnodes.forEach(function (d){
	if (logdelta) {d.delta_LBI = d.LBI/(-d.delta_LBI+1e-10);}
	else {d.delta_LBI += d.LBI;}
    });    
    maxLBI = d3.max(allnodes.map(function (d) {return d.LBI;}));
    maxdeltaLBI = d3.max(allnodes.map(function (d) {return d.delta_LBI;}));
    console.log("maximal LBI: "+maxLBI+", maximal deltaLBI: "+maxdeltaLBI);
    allnodes.forEach(function (d){
	d.delta_LBI /= maxdeltaLBI;
	d.LBI /= maxLBI;
    });    
};


/*
  function setFrequencies(node, date) {
	if (typeof node.frequencies != "undefined") {
		var sdate = ymd_format(date);
		var dates = [];
		for (var i=0, c=node.frequencies.length; i<c; i++) {
			dates.push(node.frequencies[i].date);
		}
		var index = d3.bisect(dates, sdate) - 1;
		node.frequency = node.frequencies[index].frequency;
	}
	if (typeof node.children != "undefined") {
		for (var i=0, c=node.children.length; i<c; i++) {
			setFrequencies(node.children[i], date);
		}
	}	
}
*/

function minimumAttribute(node, attr, min) {
	if (typeof node.children != "undefined") {
		for (var i=0, c=node.children.length; i<c; i++) {
			min = minimumAttribute(node.children[i], attr, min);
		}
	}
	else {
		if (node[attr] < min) {
			min = node[attr];
		}
	}
	return min;
}

function maximumAttribute(node, attr, max) {
	if (typeof node.children != "undefined") {
		for (var i=0, c=node.children.length; i<c; i++) {
			max = maximumAttribute(node.children[i], attr, max);
		}
	}
	else {
		if (node[attr] > max) {
			max = node[attr];
		}
	}
	return max;
}

	
var treeplot;
var regions;
var region_codes = {'north_america':'NA', 'south_america':'SA', 'europe':'EU','asia':'AS','oceania':'OC'} 
var width = 800,
	height = 600;

var e = document.getElementById("nNodeColoring");
var color_scheme = e.options[e.selectedIndex].value;
var minkoel=10
var e = document.getElementById("nLinkColoring");
var link_color_scheme = e.options[e.selectedIndex].value;

var e = document.getElementById("nNodeSizing");
var size_scheme = e.options[e.selectedIndex].value;

var globalDate = new Date();
var dateCutoff = globalDate;
var ymd_format = d3.time.format("%Y-%m-%d");		
var LBItau = 0.0007
var deltaLBI_boundary_layer = 200;
var tree = d3.layout.tree()
	.size([height, width]);

var tooltip = d3.tip()
	.direction('e')
	.attr('class', 'd3-tip')
    .offset([0, 10])
	.html(function(d) {
		string = ""
//		if (typeof d.frequency != "undefined") {
//			if (d.frequency > 0.01) {
//				string = d.frequency;
//			}
//		}
//		if (typeof d.target != "undefined") {
//			if (typeof d.target.frequency != "undefined") {
//				if (d.target.frequency > 0.01) {
//					string = d.target.frequency;
//				}
//			}	
//		}	
		if (typeof d.strain != "undefined") {
			string = d.strain+' '+d.date;
		}		
	    return string;
	});

var toolbranch = d3.tip()
	.direction('e')
	.attr('class', 'd3-tip')
    .offset([0, 10])
	.html(function(d) {
		string = ""
		if (typeof d.target != "undefined") {
		    for (var i=0; i<regions.length;i++){
			string += region_codes[regions[i]]+': '+d.target.geodis[regions[i]]+', ';

		    }
		}		
		return string+" HA1 muts: "+d.target.HA1_muts;
	});


function rescale(dMin, dMax, lMin, lMax, xScale, yScale, nodes, links, tips, internals, vaccines) {
    var scale_factor = (yScale.domain()[1]-yScale.domain()[0])/(lMax-lMin);
    console.log("rescale by "+scale_factor);
    var speed = 1500;
    xScale.domain([dMin,dMax]);
    yScale.domain([lMin,lMax]);
    
    nodes.forEach(function (d) {
	d.x = xScale(d.xvalue);
	d.y = yScale(d.yvalue);			 
    });	
    
    treeplot.selectAll(".tip").data(tips)
    	.transition().duration(speed)
    	.attr("cx", function(d) { return d.x; })
    	.attr("cy", function(d) { return d.y; });
    	//.attr("r", function(d) { return scale_factor*this.attr("r"); });
    
    treeplot.selectAll(".vaccine").data(vaccines)
    	.transition().duration(speed)
    	.attr("cx", function(d) { return d.x; })
    	.attr("cy", function(d) { return d.y; });     	
    
    treeplot.selectAll(".internal").data(internals)
    	.transition().duration(speed)
	.attr("x", function(d) { 
	    if (typeof d.frequency != "undefined") {		
		return d.x - 5*Math.sqrt(d.frequency) - 0.5;
	    }
	    else {
		return d.x - 1;
	    }			
	})
	.attr("y", function(d) { 
	    if (typeof d.frequency != "undefined") {		
		return d.y - 5*Math.sqrt(d.frequency) - 0.5;
	    }
	    else {
		return d.y - 1;
	    }			
	});  
    
    treeplot.selectAll(".link").data(links)
    	.transition().duration(speed)
	.attr("points", function(d) {
	    var mod = 5*Math.sqrt(d.target.frequency)+0.5;
	    return (d.source.x-mod).toString() + "," + d.source.y.toString() + " " 
		+ (d.source.x-mod).toString() + "," + d.target.y.toString() + " "
		+ (d.target.x).toString() + "," + d.target.y.toString()
	});	   		   
}

var e = document.getElementById("nTreeFile");
var tree_file = e.options[e.selectedIndex].value;

function load_tree(){
    treeplot = d3.select("#treeplot_div")
	.append("svg")
	.attr("id", "treeplot")
	.attr("width", width)
	.attr("height", height);
    treeplot.call(tooltip);		
    treeplot.call(toolbranch);		


d3.json(tree_file, function(error, root) {
    var nodes = tree.nodes(root), links = tree.links(nodes);
    regions = d3.set(nodes.map(function (d) {
	var reg;
	try {reg = d.region;}
	catch (e) {reg="undefined";}
	return reg;})).values().filter(function (d) {return d!="undefined";});
    var region_counts = {}
    for (var i=0; i<regions.length; i++) region_counts[regions[i]]=0;
    nodes.forEach(function (d) {region_counts[d.region]+=1;});

    console.log("Regions found:", regions);
    var koelGTs = d3.set(nodes.map(function (d) {return d.koel;})).values();
    var koelGT_counts = {}
    for (var i=0; i<koelGTs.length; i++) koelGT_counts[koelGTs[i]]=0;
    nodes.forEach(function (d) {koelGT_counts[d.koel]+=1;});
    koelGTs = koelGTs.filter(function (d) {return koelGT_counts[d]>=minkoel;});
    koelGTs.sort(function (a,b){var res; 
				 if (koelGT_counts[a]>koelGT_counts[b]){ res=-1;}
				 else if (koelGT_counts[a]<koelGT_counts[b]){ res=1;}
				 else {res=0;}
				 return res;});
    console.log("Koel genotypes passed filtering:"+koelGTs);

    var rootNode = nodes[0];
    var tips = gatherTips(rootNode, []);
    var internals = gatherInternals(rootNode, []);
    calcBranchLength(rootNode);
    rootNode.branch_length= 0.01;
    setFrequencies(rootNode);
    setDates(internals);
    nodes.forEach(function (d) {d.dateval = new Date(d.date)});
    calc_deltaLBI(rootNode, nodes, false);
    calcGeoDistribution(rootNode,regions);

    var vaccines = getVaccines(tips);	
    
    var	xValues = nodes.map(function(d) {
  	return +d.xvalue;
    });  
    
    var yValues = nodes.map(function(d) {
  	return +d.yvalue;
    }); 
    
    var dateValues = tips.filter(function(d) {
	return typeof d.date === 'string';
    }).map(function(d) {
  	return new Date(d.date);
    }); 	
    
    var yearValues = nodes.filter(function(d) {
		return typeof d.date === 'string';
    }).map(function(d) {
  	return (new Date(d.date)).getFullYear();
    }); 	  	
    
    var xScale = d3.scale.linear()
	.domain([d3.min(xValues), d3.max(xValues)])
	.range([10, width-10]);
    
    var yScale = d3.scale.linear()
	.domain([d3.min(yValues), d3.max(yValues)])
	.range([10, height-10]);	
    
    var earliestDate = new Date(d3.min(dateValues));
    earliestDate.setDate(earliestDate.getDate() + 20);	
    
    var dateScale = d3.time.scale()
	.domain([earliestDate, globalDate])
	.range([-100, 100])
	.clamp([true]);

    var dateSliderScale = d3.time.scale()
	.domain([earliestDate, globalDate])
	.range([0, 100]);
    
    var dateColorScale = d3.time.scale()
	.domain([earliestDate, globalDate])
/*        .interpolate(d3.interpolateRgb)
        .range(["darkblue", "blue", "cyan",
               "green", "yellow",
               "orange", "red"]);
*/	.range(["#000000","#FF0000"]);
    
    var yearScale = d3.scale.ordinal()
	.domain([2014, "undefined", 2011, 2012, 2013])
	.range(["#ff7f0e", "#1f77b4", "#7f7f7f", "#7f7f7f", "#7f7f7f"]);
    
    var recencyColorScale = d3.scale.threshold()
		.domain([0.00, 0.33, 0.66, 1.0])
	.range(["#aaa", "#E04328", "#E78C36", "#CFB642", "#799CB3"]);	// red, orange, yellow, blue
    
    var recencySizeScale = d3.scale.threshold()
	.domain([0.0, 0.33, 0.66, 1.0])
	.range([0, 3.25, 2.5, 1.75, 1]);	
    
    //if (colorbrewer!="undefined"){
    try{
	cmap5 = colorbrewer['RdYlBu'][5].reverse();
	cmap6 = colorbrewer['RdYlBu'][6].reverse();
    }catch (e) {
	console.log("colorbrewer not available");
	cmap5 = ['#000000', '#FF0000']
	cmap6 = ['#000000', '#FF0000']
    }
    var LBIColorScaleLog = d3.scale.linear()
	.domain([0, 3.3e-3, 1e-2, 3.3e-2, 1e-1, 3.3e-1, 1.0])
        .interpolate(d3.interpolateRgb)
        .range(["darkblue", "blue", "cyan",
               "green", "yellow",
               "orange", "red"]);

/*    var LBIColorScaleLog = d3.scale.linear()
	.domain([1e-2, 3.3e-2, 1e-1, 3.3e-1, 1.0])
	.range(cmap5);
  */  
    var LBIColorScaleLinear = d3.scale.linear()
	.domain([0, .2, .4, .6, .8, 1.0])
	.range(cmap6);
    
    var LBISizeScaleLinear = d3.scale.threshold()
	.domain([0.0, 0.33, 0.66, 1.0-1e-10, 1])
	.range([1, 2, 2.3, 2.7, 3, 7]);	

    var LBISizeScaleLog = d3.scale.log()
	.domain([1e-2, 1.0-1e-10, 1])
	.range([1, 3,7]);
    
    var recencyVaccineSizeScale = d3.scale.threshold()
	.domain([0.0])
	.range([0, 8]);
    
    var recencyLinksSizeScale = d3.scale.threshold()
	.domain([0.0])
	.range([0, 2]);					
    
    var freqScale = d3.scale.sqrt()
	.domain([0, 1])
	.range([1, 10]);

    //+ Jonas Raoni Soares Silva
    //@ http://jsfromhell.com/array/shuffle [v1.0]
    function shuffle(o){ //v1.0
	for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
	return o;
    };
    region_range = []
    for (var i=1; i<regions.length+1; i++) {
	region_range.push(rainbow(regions.length+1, i));
    }
    koelGTs_range = []
    for (var i=1; i<koelGTs.length+1; i++) {
	koelGTs_range.push(rainbow(koelGTs.length+1, i));
    }
    //koelGTs_range = shuffle(koelGTs_range);
    var regionsColorScale = d3.scale.ordinal()
	.domain(regions)
	.range(region_range);
    var KoelColorScale = d3.scale.ordinal()
	.domain(koelGTs)
	.range(koelGTs_range);

    
    function nodeSizing(d){
	if (d.alive){
	    if (size_scheme=="LBI") return LBISizeScaleLinear(d.LBI); 
	    else if (size_scheme=="recency") return recencySizeScale(d.diff);
	    else if (size_scheme=="delta_LBI") return LBISizeScaleLinear(d.delta_LBI);
	    else if (size_scheme=="LBI_log") return LBISizeScaleLog(d.LBI);
	    else if (size_scheme=="delta_LBI_log") return LBISizeScaleLog(d.delta_LBI);
	    else if (size_scheme=="1") return 1;
	    else if (size_scheme=="2") return 2;
	    else if (size_scheme=="4") return 4;
	}else{ return 1;}
    };

    function nodeColoring(d) { 
	if (d.alive){
	    if (color_scheme=="LBI_log") col = LBIColorScaleLog(d.LBI); 
	    else if (color_scheme=="LBI") col = LBIColorScaleLinear(d.LBI); 
	    else if (color_scheme=="recency") col = recencyColorScale(d.diff);
	    else if (color_scheme=="date") col = dateColorScale(d.dateval);
	    else if (color_scheme=="delta_LBI") col = LBIColorScaleLinear(d.delta_LBI);
	    else if (color_scheme=="delta_LBI_log") col = LBIColorScaleLog(d.delta_LBI);
	    else if (color_scheme=="koel") col = KoelColorScale(d.koel);
	    else if (color_scheme=="region") col = regionsColorScale(d.region);
	    //return d3.rgb(col).brighter([0.7]).toString();
	    return d3.rgb(col).toString();
	}else{
	    return "#AAAAAA"
	}
    };

    function linkColoring(d) { 
	if (d.target.alive){
	    if (link_color_scheme=="LBI_log") col = LBIColorScaleLog(d.target.LBI); 
	    else if (link_color_scheme=="LBI") col = LBIColorScaleLinear(d.target.LBI); 
	    else if (link_color_scheme=="recency") col = recencyColorScale(d.target.diff);
	    else if (link_color_scheme=="date") col = dateColorScale(d.target.dateval);
	    else if (link_color_scheme=="delta_LBI") col = LBIColorScaleLinear(d.target.delta_LBI);
	    else if (link_color_scheme=="delta_LBI_log") col = LBIColorScaleLog(d.target.delta_LBI);
	    else if (link_color_scheme=="koel") col = KoelColorScale(d.target.koel);
	    else if (link_color_scheme=="None") col = '#AAAAAA';
	    //return d3.rgb(col).brighter([0.7]).toString();
	    return d3.rgb(col).toString();
	}else{
	    return "#AAAAAA"
	}
    };

    nodes.forEach(function (d) {
	d.x = xScale(d.xvalue);
	d.y = yScale(d.yvalue);			 
    });

    // straight links
    /*	var link = treeplot.selectAll(".link")
	.data(links)
	.enter().append("line")
	.attr("class", "link")
	.attr("x1", function(d) { return d.source.x; })
	.attr("y1", function(d) { return d.source.y; })
	.attr("x2", function(d) { return d.target.x; })
	.attr("y2", function(d) { return d.target.y; }); 
    */	    	    
    
    var link = treeplot.selectAll(".link")
	.data(links)
	.enter().append("polyline")
	.attr("class", "link")
	.attr("points", function(d) {
	    var mod = 5*Math.sqrt(d.target.frequency)+0.5;
	    return (d.source.x-mod).toString() + "," + d.source.y.toString() + " " 
		+ (d.source.x-mod).toString() + "," + d.target.y.toString() + " "
		+ (d.target.x).toString() + "," + d.target.y.toString()
	})
	.style("stroke-width", 2)   
	.style("stroke", function(d){return linkColoring(d);})
    	.style("cursor", "pointer")		 
	.on('mouseover', function (d) {toolbranch.show(d, this);})
      	.on('mouseout', toolbranch.hide)
     	.on('click', function(d) { 
      	    var dMin = minimumAttribute(d.target, "xvalue", d.target.xvalue),
      	    dMax = maximumAttribute(d.target, "xvalue", d.target.xvalue),
      	    lMin = minimumAttribute(d.target, "yvalue", d.target.yvalue),
      	    lMax = maximumAttribute(d.target, "yvalue", d.target.yvalue);
      	    rescale(dMin, dMax, lMin, lMax, xScale, yScale, nodes, links, tips, internals, vaccines);
      	}); 

    var legendRectSize = 18;
    var legendSpacing = 4;
    var koelLegend = treeplot.selectAll(".legend")
	.data(koelGTs)
	.enter().append('g')
	.attr('class', 'legend')
	.attr('transform', function(d, i) {
	    var height = legendRectSize + legendSpacing;
	    var offset =  -100; 
	    var horz = 2 * legendRectSize;
	    var vert = i * height - offset;
	    return 'translate(' + horz + ',' + vert + ')';
	});


    koelLegend.append('rect')
	.attr('width', legendRectSize)
	.attr('height', legendRectSize)
	.style('fill', function (d) {return KoelColorScale(d);})
	.style('stroke', function (d) {return KoelColorScale(d);});

    koelLegend.append('text')
	.attr('x', legendRectSize + legendSpacing)
	.attr('y', legendRectSize - legendSpacing)
	.text(function(d) {return d+" #:"+koelGT_counts[d]; });

    var regionsLegend = treeplot.selectAll(".legend2")
	.data(regions)
	.enter().append('g')
	.attr('class', 'legend2')
	.attr('transform', function(d, i) {
	    var height = legendRectSize + legendSpacing;
	    var offset =  -100; 
	    var horz = 150+2 * legendRectSize;
	    var vert = i * height - offset;
	    return 'translate(' + horz + ',' + vert + ')';
	});


    regionsLegend.append('rect')
	.attr('width', legendRectSize)
	.attr('height', legendRectSize)
	.style('fill', function (d) {return regionsColorScale(d);})
	.style('stroke', function (d) {return regionsColorScale(d);});

    regionsLegend.append('text')
	.attr('x', legendRectSize + legendSpacing)
	.attr('y', legendRectSize - legendSpacing)
	.text(function(d) {return region_codes[d]+" #:"+region_counts[d]; });


    tips.forEach(function (d) {
	var date = new Date(d.date);		
	var oneYear = 365.25*24*60*60*1000; // days*hours*minutes*seconds*milliseconds
	var diffYears = (globalDate.getTime() - date.getTime()) / oneYear;		
	d.diff = diffYears; 
    });	       	  	  
	    
    var tipCircles = treeplot.selectAll(".tip")
	.data(tips)
	.enter()
	.append("circle")
	.attr("class", "tip")
	.attr("id", function(d) { return (d.strain).replace(/\//g, ""); })
	.attr("cx", function(d) { return d.x; })
	.attr("cy", function(d) { return d.y; })
	.attr("r", function(d) { return nodeSizing(d);})
	.style("fill", function(d){return nodeColoring(d);})	
	.style("opacity",1.0)
	.style("stroke", function(d){return nodeColoring(d);})
	.on('mouseover', function(d) {
	    tooltip.show(d, this);
	})
      	.on('mouseout', tooltip.hide);
    
    function tipCirclesUpdate(){
    	treeplot.selectAll(".tip")
	    .style("fill", function(d){return nodeColoring(d);})	
	    .style("stroke", function(d){return nodeColoring(d);})
	    .attr("r", function(d) { return nodeSizing(d);})
    };

    function linkUpdate(){
    	treeplot.selectAll(".link")
	    .style("stroke", function(d){return linkColoring(d);})
    };


    var vaccineCircles = treeplot.selectAll(".vaccine")
	.data(vaccines)
	.enter()
	.append("circle")
	.attr("class", "vaccine")
	.attr("cx", function(d) {return d.x})
	.attr("cy", function(d) {return d.y})	
	.attr("r", function(d) {
	    return recencyVaccineSizeScale(d.diff);
	})	
	.style("fill", d3.rgb("#97BE60").brighter([0.45]).toString())	
	.style("stroke", "#97BE60")
	.on('mouseover', function(d) {
	    tooltip.show(d, this);
	})	
      	.on('mouseout', tooltip.hide);					
    
    
    var drag = d3.behavior.drag()
	.origin(function(d) { return d; })
	.on("drag", dragged)
	.on("dragstart", function() {
	    d3.select(this).style("fill", "#799CB3");
	})
	.on("dragend", function() {
	    d3.select(this).style("fill", "#CCC");
	});
    
    function dragged(d) {
	d.date = dateScale.invert(d3.event.x);
	d.x = dateScale(d.date);
	d3.selectAll(".counter-text")
	    .text(function(d){ 
    		return format(d.date) 
    	    });
	globalDate = d.date;
	nodes.forEach(function (d) {
	    var date = new Date(d.date);		
	    var oneYear = 365.25*24*60*60*1000; // days*hours*minutes*seconds*milliseconds
	    var diffYears = (globalDate.getTime() - date.getTime()) / oneYear;		
	    d.diff = diffYears; 
	});			
	d3.selectAll(".tip")
	    .attr("r", function(d) {
				return recencySizeScale(d.diff);
	    })		
	    .style("fill", function(d) { 
		var col = recencyColorScale(d.diff);
		return d3.rgb(col).brighter([0.7]).toString();	
	    })	    		
	    .style("stroke", function(d) { 
		var col = recencyColorScale(d.diff);
		return d3.rgb(col).toString();	
	    }); 
	d3.selectAll(".vaccine")
	    .attr("r", function(d) {
		return recencyVaccineSizeScale(d.diff);
	    });	
	d3.selectAll(".link")
	    .style("stroke-width", function(d) {
		return recencyLinksSizeScale(d.target.diff);		    	
	    });			
	
    }
    
    var counterData = {}
    counterData['date'] = globalDate	
    counterData['x'] = dateScale(globalDate)
    
    var format = d3.time.format("%Y %b %-d");
    var counterText = treeplot.selectAll(".counter-text")
	.data([counterData])
	.enter()
	.append("text")			
	.attr("class", "counter-text") 
    	.attr("transform", "translate(100,40)")
    	.style("text-anchor", "middle")
    	.style("alignment-baseline", "middle")
    	.text(function(d){ 
    	    return format(d.date) 
    	})
    	.style("cursor", "col-resize")
    	.call(drag);     
    
    d3.select("#reset")
        .on("click", function(d) {
	    var dMin = d3.min(xValues),
      	    dMax = d3.max(xValues),
      	    lMin = d3.min(yValues),
      	    lMax = d3.max(yValues);        	
            rescale(dMin, dMax, lMin, lMax, xScale, yScale, nodes, links, tips, internals, vaccines);
	})  
    
    function onSelect(tip) {
	d3.select("#"+(tip.strain).replace(/\//g, ""))
	    .call(function(d) {
		tooltip.show(tip, d[0][0]);
	    });
    }		
    
    var mc = autocomplete(document.getElementById('search'))
	.keys(tips)
	.dataField("strain")
	.placeHolder("Search strains")
	.width(800)
	.height(500)
	.onSelected(onSelect)
	.render();	
    
    d3.select("#nDateCutoff-value").text(ymd_format(dateCutoff));
    d3.select("#nDateCutoff").on("change", function(){
	dateCutoff = dateSliderScale.invert(+this.value);
	d3.select("#nDateCutoff-value").text(ymd_format(dateCutoff));
	console.log("changing date Cutoff to:" +dateCutoff);
	calc_deltaLBI(rootNode, nodes, false);
	calcGeoDistribution(rootNode,regions);
	tipCirclesUpdate();
	linkUpdate();
    });
    d3.select("#nDateCutoff").on("input", function(){
	dateCutoff = dateSliderScale.invert(+this.value);
	d3.select("#nDateCutoff-value").text(ymd_format(dateCutoff));
    });

    d3.select("#nBoundaryLayer-value").text(deltaLBI_boundary_layer);
    d3.select("#nBoundaryLayer").on("change", function(){
	deltaLBI_boundary_layer =+ this.value;
	d3.select("#nBoundaryLayer-value").text(deltaLBI_boundary_layer);
	console.log("changing boundary layer to:" +deltaLBI_boundary_layer);
	calc_deltaLBI(rootNode, nodes, false);
	tipCirclesUpdate();
    });
    d3.select("#nBoundaryLayer").on("input", function(){
	d3.select("#nBoundaryLayer-value").text(+this.value);
    });

    d3.select("#nLBItau-value").text(LBItau);
    d3.select("#nLBItau").on("change", function(){
	LBItau =+ this.value;
	d3.select("#nLBItau-value").text(LBItau);
	console.log("changing LBItau to:" +LBItau);
	calc_deltaLBI(rootNode, nodes, false);
	tipCirclesUpdate();
    });
    d3.select("#nLBItau").on("input", function(){
	d3.select("#nLBItau-value").text(+this.value);
    });

    d3.select("#nNodeColoring").on("change", function(){
	console.log("change node coloring to");
	color_scheme=d3.select(this).property('value');
	console.log(color_scheme);
	tipCirclesUpdate();
    });

    d3.select("#nLinkColoring").on("change", function(){
	console.log("change link coloring to");
	link_color_scheme=d3.select(this).property('value');
	console.log(color_scheme);
	linkUpdate();
    });

    d3.select("#nNodeSizing").on("change", function(){
	console.log("change node sizing to");
	size_scheme = d3.select(this).property('value');
	console.log(size_scheme);
	tipCirclesUpdate();
    });

    d3.selectAll().append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + (-200 - 1.5 * 50 - 20) + ")")
        .call(d3.svg.axis()
              .scale(xTSlider)
              .orient("top"))
        .select(".domain")
        .select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
        .attr("class", "halo");		
});
};

load_tree();

d3.select("#nTreeFile").on("change", function(){
    console.log("change tree file to ");
    tree_file = d3.select(this).property('value');
    console.log(tree_file);
    d3.select("#treeplot").remove();
    load_tree();
    
});
