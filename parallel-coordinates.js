﻿//
// Copyright 2011, Boundary
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
(function ($, undefined) {

	/**
	 * get mouse position relative to container
	 *
	 * @method getPos
	 * @param [el] the container element
	 * @param [e] the event object
	 * @chainable
	*/
	

	function getPos(el, e) {
		var parentOffset = $(el).offset();
		var relX = e.pageX - parentOffset.left;
		var relY = e.pageY - parentOffset.top;
		return {
			x: relX,
			y: relY
		};
	};


	/**
	 * turn pixel coordinates into data range
	 *
	 * @method getColumnRange
	 * @param [top] the top position of column
	 * @param [bottom] the bottom position of column
	 * @param [maxHeight] determine max Height
	 * @param [maxHeight] determine max Height
	 * @param [range] JSON contain min,max of allowable height
	 * @chainable
	*/
	function getColumnRange(top, bottom, maxHeight, column, range) {
		var max = range.max;
		var min = range.min;
		var height = bottom - top;
		var step = (max - min) / maxHeight;
		return {
			field: column,
			max: max - (top * step),
			min: max - ((top + height) * step),
			top: top,
			bottom: bottom,
			height: height
		};
	};

	// opacity value for drawn line
	var opacity = 0.2;

	/**
	 * each Axis represents uniqe information about questionnaire
	 *
	 * @method removeFilter 
	 *	to remove filter 
	 * @method activate
	 *	start filter from this coordinates
	 * @method mousemove
	 *	add this coordinates to filter
	 * @method deactivate
	 *	stop filter from this coordinates
	*/
	var Axis = Backbone.View.extend({
		events: {
			'dblclick .axis-data': 'removeFilter',
			'mousedown .axis-data': 'activate',
			'mousemove .axis-data': 'mousemove',
			'mouseup': 'deactivate',
			'mouseleave': 'deactivate'
		},
		initialize: function (opts) {
			var self = this;
			this.name = opts.name;
			this.filtered = false;
			this.active = false;
			this.top = 0;
			this.height = opts.height;
			this.x = opts.x;
			this.temporary = false;
			this.canvas = this.make('canvas', {
				"class": 'axis-data',
				"width": 40,
				"height": this.height,
				"rel": this.name,
				"style": 'top: 0px;left: 0px;'
			});
			this.filter = this.make('div', {
				"class": 'axis-filter',
				"style": 'top: 0px;height:0px;'
			});
			this.el.appendChild(this.canvas);
			this.el.appendChild(this.filter);
			this.ctx = this.canvas.getContext('2d');
			
			// Represent the color map
			$("#color-map").empty();
			for (var i = 0; i < 70; i++) {
				var w = 2 + i / 2;
				var c = parseInt(w * 8);
				c = c > 255 ? 255 : c;

				$("#color-map").append('<div style="width:2px; float:left;height:10px;background-color:' + 'rgba(' + c + ',' + 0 + ',' + (255 - c) + ',0.8)' + ';"></div>');
			}
			// Drag and drop .
			$(this.filter).draggable({
				containment: $(self.el),
				axis: 'y',
				drag: function (e, ui) {
					var range = getColumnRange($(this).position().top - 10, $(this).position().top - 10 + $(this).height(), self.height - 20, self.name, self.range);
					self.addFilter(range);
				},
				stop: function (e, ui) {
					var range = getColumnRange($(this).position().top - 10, $(this).position().top - 10 + $(this).height(), self.height - 20, self.name, self.range);
					self.addFilter(range);
				}
			});
		},
		activate: function (e) {
			if (this.canvas == e.target) {
				this.active = true;
				this.startdrag = getPos(this.el, e);
				this.startdrag.y = this.startdrag.y;
			}
		},
		deactivate: function (e) {
			this.active = false;
			this.startdrag = false;
		},
		mousemove: function (e) {
			if (this.active) {
				var pos = getPos(this.el, e);
				var start = this.startdrag;
				// apply filter
				if (pos.y > start.y) {
					var min = start.y;
					var max = pos.y;
				} else {
					var min = pos.y;
					var max = start.y;
				}
				var range = getColumnRange(min - 10, max - 10, this.height - 20, this.name, this.range);
				this.addFilter(range);
			}
		},
		addFilter: function (filter) {
			var self = this;
			this.filtered = true;
			this.top = filter.top + 10;
			$(this.filter).css({
				'height': filter.height,
				'top': self.top
			}).addClass('active');
			this.model.add(filter);
		},
		removeFilter: function () {
			var self = this;
			this.filtered = false;
			$(this.filter).css({
				'height': 0,
				'top': 0
			}).removeClass('active');
			this.model.remove(this.name);
		}
	});

	/**
	 * represents the Chart that contails the Axis and lines
	 *
	 * @method activate
	 *	start filter from this coordinates
	 * @method mousemove
	 *	add this coordinates to filter
	 * @method deactivate
	 *	stop filter from this coordinates
	*/
	window.Parallel_coordinates = Backbone.View.extend({
		events: {
			'mousedown': 'activate',
			'mousemove': 'mousemove',
			'mouseup': 'deactivate',

		},

		activate: function (e) {
			if (this.selection.el == e.target) {
				this.active = true;
				this.startdrag = getPos(this.el, e);
			}
		},
		deactivate: function (e) {
			if (!this.startdrag)
				return; // dragging axis bug
			var self = this;
			var pos = getPos(this.el, e);
			var start = this.startdrag;

			// apply filter
			_(this.axes).each(function (axis, key) {
				var min = {},
					max = {};
				if (pos.x > start.x) {
					min.x = start.x;
					max.x = pos.x;
				} else {
					min.x = pos.x;
					max.x = start.x;
				}
				if (pos.y > start.y) {
					min.y = start.y;
					max.y = pos.y;
				} else {
					min.y = pos.y;
					max.y = start.y;
				}
				if ((axis.x > min.x) && (axis.x < max.x)) {
					self.addFilter(getColumnRange(min.y - self.gutter.y, max.y - self.gutter.y, (self.height) - ((self.gutter.y) * 2), key, self.range[key]));
					axis.temporary = false;
				} else if (axis.temporary) {
					self.removeFilter(key);
				}
			});

			this.selection.ctx.clearRect(0, 0, this.width, this.height);
			this.active = false;
			this.startdrag = false;
		},
		mousemove: function (e) {
			if (this.active) {
				var self = this;
				var pos = getPos(this.el, e);
				var start = this.startdrag;
				this.selection.ctx.clearRect(0, 0, this.width, this.height);
				this.selection.ctx.fillStyle = "rgba(255,235,55,0.4)";
				this.selection.ctx.fillRect(start.x, start.y, pos.x - start.x, pos.y - start.y);
				// apply filter
				_(this.axes).each(function (axis, key) {
					var min = {},
						max = {};
					if (pos.x > start.x) {
						min.x = start.x;
						max.x = pos.x;
					} else {
						min.x = pos.x;
						max.x = start.x;
					}
					if (pos.y > start.y) {
						min.y = start.y;
						max.y = pos.y;
					} else {
						min.y = pos.y;
						max.y = start.y;
					}
					if ((axis.x > min.x) && (axis.x < max.x)) {
						self.addFilter(getColumnRange(min.y - self.gutter.y, max.y - self.gutter.y, (self.height) - ((self.gutter.y) * 2), key, self.range[key]));
						axis.temporary = true;
					} else if (axis.temporary) {
						self.removeFilter(key);
					}
				});
			}

		},
		initialize: function (options) {
			var self = this;
			this.axes = {};
			this.filter = {};
			this.active = false;
			this.columns_new = null;
			for (var k in options) {
				this[k] = options[k];
			}
			this.model.bind('change:filter', function () {
				var filters = self.model.get('filter');
				for (key in filters) {
				}
			});
			this.model.bind('change:filtered', function () {
				self.update();
			});
			this.render();
			$(this.el).on('mouseleave', function () {
				self.coloring = false;
				self.update();
			});
			$('input[type="range"]').mouseup(function () {
				var newOpacity = $(this).val()/10;
				if (newOpacity != opacity) {
					opacity = newOpacity;
					self.update();
				}
			});


		},
		render: function () {
			var self = this;

			this.canvas = {};
			this.selection = {};

			this.canvas.el = this.make('canvas', {
				width: this.width,
				height: this.height
			});

			this.selection.el = this.make('canvas', {
				width: this.width,
				height: this.height
			});

			this.canvas.ctx = this.canvas.el.getContext('2d');
			this.selection.ctx = this.selection.el.getContext('2d');

			this.el.appendChild(this.canvas.el);
			this.el.appendChild(this.selection.el);

			var scrubbers = [];
			var space = (this.width - this.gutter.x) / (this.columns.length - 1);

			for (var i = 0; i < this.columns.length; i++) {
				var axis = this.axes[this.columns[i]] = new Axis({
					name: this.columns[i],
					height: this.height - 2 * (this.gutter.y - 10),
					x: (i * space),
					gutter: this.gutter,
					model: this.model,
					el: this.make('div', {
						"class": 'axis',
						"rel": this.columns[i],
						"style": 'top: ' + (this.gutter.y - 10) + 'px;' +
						'left: ' + ((i * space) - 20) + 'px;height:' + (this.height - 2 * (this.gutter.y - 10)) + 'px;',
					})
				});

				this.el.appendChild(axis.el);

				$(axis.el).hover(function () {
					self.coloring = $(this).attr('rel');
					self.update();
				}, function () {
					//self.update();
				});
			};

			$(this.el).css({
				'height': this.height,
				'width': this.width
			});

			return this;
		},

		className: 'parallel-coordinates',

		addFilter: function (filter) {
			this.axes[filter.field].addFilter(filter);
		},

		removeFilter: function (key) {
			this.axes[key].removeFilter();
			this.model.remove(key);
		},

		update: function () {
			var self = this,
				ctx = this.canvas.ctx,
				cols = (this.columns_new == null) ? this.columns : this.columns_new,
				n = cols.length,
				w = this.width,
				h = this.height,
				alias = this.alias;

			var data = this.model.get('data');
			var filtered = this.model.get('filtered');
			this.size = filtered.length;
			this.cols = [];

			if (!self.coloring)
				var line_stroke = this.lineStroke || "hsla(0,00%,20%," + (3 / Math.sqrt(this.size)) + ")";
			var text_fill = this.textFill || "#222";
			ctx.clearRect(0, 0, w, h);

			// Get column ranges
			self.range = [];
			_(cols).each(function (col, i) {

				var g_min = $("#mintx").val();
				var g_max = $("#maxtx").val();
				if (col != "Level" && col != "Subject" && col != "Question_Number" &&
						!isNaN(g_min) && !isNaN(g_max) &&
						$("#chkMinMax").attr("checked")) {
					self.range[col] = {
						min: g_min,
						max: g_max,
						size: g_max - g_min
					};
					self.axes[col].range = self.range[col];

				} else {
					var min = _(data).chain().pluck(col).min().value(),
						max = _(data).chain().pluck(col).max().value();
					self.range[col] = {
						min: min,
						max: max,
						size: max - min
					};
					self.axes[col].range = self.range[col];

				}
			});

			// Draw columns
			var space = (w - 2 - this.gutter.x) / (n - 1);
			_(cols).each(function (col, i) {

				if (typeof alias[col] == 'string') {
					var name = alias[col];
				} else {
					var name = col;
				}
				self.cols.push({
					col: col,
					x: space * i
				});
				
				// define the font name and size of the axes lable.
				ctx.fillStyle = "hsla(0,0%,30%,0.05)";
				//ctx.fillRect(space*i-1, self.gutter.y-12, 2, h-(2*self.gutter.y)+24);
				ctx.fillStyle = text_fill;
				ctx.font = "bold 10px Helvetica";
				ctx.fillText(name, space * i, 12);
				ctx.font = "12px Helvetica";
				ctx.fillText(self.range[col].min, space * i, h - 24);
				ctx.fillText(self.range[col].max, space * i, 28);

			});
			function gutters(gutter, h, d, col) {

				if (self.range[col].size == 0)
					return gutter + ((h - (2 * gutter)) / 2);

				return gutter + (h - (2 * gutter)) * ((self.range[col].max - d[col]) / self.range[col].size);
			};
			

			function rgbToHex(r, g, b) {
			    if (r > 255 || g > 255 || b > 255)
			        throw "Invalid color component";
			    return ((r << 16) | (g << 8) | b).toString(16);
			}

			// Draw dots
			_(cols).each(function (col, i) {
				self.axes[col].ctx.clearRect(0, 0, 40, self.height);
			});
			// Draw dots
			_(cols).each(function (col, i) {

				var dots = [];
				self.axes[col].ctx.fillStyle = 'rgba(50,50,50,0.35)';
				// _(data).each(function(d,k) {
				_(filtered).each(function (d, k) {
					var y = gutters(self.gutter.y, h, d, col);
					var yy = parseInt(y);
					dots[yy] = (dots[yy] == undefined) ? 1 : dots[yy] + 1;

					/*
					 * if (self.coloring) { var frac =
					 * Math.round(250*(self.range[self.coloring].max-d[self.coloring])/self.range[self.coloring].size);
					 * self.axes[col].ctx.fillStyle = "hsla(" + frac + ",35%,50%,0.6)"; }
					 */
					self.axes[col].ctx.fillRect(18.5, y - 41.5, 2, 2);
				});
				
				// represent the density.
				if ($("#chkDensity").attr("checked")) {
					$.each(dots, function (key, val) {
						if (val != undefined) {
							var w = 2 + val / 2;
							var c = parseInt(w * 8);
							c = c > 255 ? 255 : c;
						    //  console.log("val="+val);

							var c = $('__processing0').getContext('2d');
							var p = c.getImageData(w*2, y, 1, 1).data;

							self.axes[col].ctx.fillStyle = 'rgba(' + p[0] + ',' + p[1] + ',' + p[2] + ',0.8)';
							self.axes[col].ctx.fillRect(19.5 - w / 2, key - 46.5, w, 9);
						}
					});
				}
			});


			var draw_type = $('input[name=lineType]:checked').val();
			$('#opactiy').html(opacity);

			// Draw lines
			if (line_stroke)
				ctx.strokeStyle = line_stroke;
			ctx.fillStyle = line_stroke;

			var org_style = ctx.strokeStyle;

			_(filtered).each(function (d, k) {
				/*
						if (self.coloring) {
						  var frac = Math.round((self.range[self.coloring].max-d[self.coloring])/self.range[self.coloring].size); 
						  org_style = "hsla(" + (250*frac) + ",45%,30%," + (3/Math.sqrt(self.size)) + ")";
						}else{
				*/
				// Represent each level with different color
				if (d.Level == 1) {
					org_style = "rgba(239,64,166," + opacity + ")";	//"#1761cc";
				} else if (d.Level == 2) {
					org_style = "rgba(177,191,51," + opacity + ")";	//"#b1bf33";
				} else if (d.Level == 3) {
					org_style = "rgba(64,208,239," + opacity + ")";	//"#40d0ef";
				} else {
					console.log(d);
				}
				//		}
				// Selecting row
				if (d.id == slicky.select_Id) { 
					ctx.strokeStyle = "#FF0000";
					ctx.lineWidth = 5;
				} else {
					ctx.strokeStyle = org_style;
					ctx.lineWidth = 1;
				}
				// define a starting point.
				ctx.beginPath();
				var x0 = 0;
				var y0 = 0;
				_(cols).each(function (col, i) {
					var x = space * i;
					var y = gutters(self.gutter.y, h, d, col);

					if (i == 0) { // first axis.
						ctx.moveTo(x, y); // start point
					} else {
						if (draw_type == "ln") {
							ctx.lineTo(x, y);
						} else {
							var cp1x = x - 0.7 * (x - x0); // The x-coordinate of the first Bézier control point.
							var cp1y = y0; // The x-coordinate of the first Bézier control point.
							var cp2x = x - 0.3 * (x - x0); // The x-coordinate of the second Bézier control point.
							var cp2y = y; // The y-coordinate of the second Bézier control point.
							ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y); // (cp1x,cp1y): control point1, (cp2x,cp2y): control point2, (x,y): ending point.
						}

					}
					x0 = x;
					y0 = y;
				});
				ctx.stroke();
			});
		},

		// Redraw with new columns
		rearrange: function (cols) {

			this.columns_new = cols;

			var space = (this.width - 2 - this.gutter.x) / (this.columns_new.length - 1);

			// caculate axis position.
			for (var i = 0; i < this.columns_new.length; i++) {
				var nm = this.columns_new[i];
				this.axes[nm].x = (i * space);
				$(this.axes[nm].el).css('left', ((i * space) - 20) + 'px');
				$(this.axes[nm].el).css('display', 'block');
			}

			// Hide removed columns
			for (var i = 0; i < this.columns.length; i++) {
				var nm = this.columns[i];
				if (!this._is_visible_column(nm)) {
					$(this.axes[nm].el).css('display', 'none');
				}
			}

			this.update();

		},

		// check removed column
		_is_visible_column: function (column_name) {
			if (this.columns_new == null)
				return true;
			if ($.inArray(column_name, this.columns_new) !== -1)
				return true;
			return false;
		}
	});

})(jQuery);
