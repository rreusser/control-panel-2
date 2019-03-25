'use strict';

var VNode = function VNode() {};

var options = {};

var stack = [];

var EMPTY_CHILDREN = [];

function h(nodeName, attributes) {
	var children = EMPTY_CHILDREN,
	    lastSimple,
	    child,
	    simple,
	    i;
	for (i = arguments.length; i-- > 2;) {
		stack.push(arguments[i]);
	}
	if (attributes && attributes.children != null) {
		if (!stack.length) stack.push(attributes.children);
		delete attributes.children;
	}
	while (stack.length) {
		if ((child = stack.pop()) && child.pop !== undefined) {
			for (i = child.length; i--;) {
				stack.push(child[i]);
			}
		} else {
			if (typeof child === 'boolean') child = null;

			if (simple = typeof nodeName !== 'function') {
				if (child == null) child = '';else if (typeof child === 'number') child = String(child);else if (typeof child !== 'string') simple = false;
			}

			if (simple && lastSimple) {
				children[children.length - 1] += child;
			} else if (children === EMPTY_CHILDREN) {
				children = [child];
			} else {
				children.push(child);
			}

			lastSimple = simple;
		}
	}

	var p = new VNode();
	p.nodeName = nodeName;
	p.children = children;
	p.attributes = attributes == null ? undefined : attributes;
	p.key = attributes == null ? undefined : attributes.key;

	if (options.vnode !== undefined) options.vnode(p);

	return p;
}

function extend(obj, props) {
	for (var i in props) {
		obj[i] = props[i];
	}return obj;
}

var defer = typeof Promise == 'function' ? Promise.resolve().then.bind(Promise.resolve()) : setTimeout;

function cloneElement(vnode, props) {
	return h(vnode.nodeName, extend(extend({}, vnode.attributes), props), arguments.length > 2 ? [].slice.call(arguments, 2) : vnode.children);
}

var IS_NON_DIMENSIONAL = /acit|ex(?:s|g|n|p|$)|rph|ows|mnc|ntw|ine[ch]|zoo|^ord/i;

var items = [];

function enqueueRender(component) {
	if (!component._dirty && (component._dirty = true) && items.push(component) == 1) {
		(options.debounceRendering || defer)(rerender);
	}
}

function rerender() {
	var p,
	    list = items;
	items = [];
	while (p = list.pop()) {
		if (p._dirty) renderComponent(p);
	}
}

function isSameNodeType(node, vnode, hydrating) {
	if (typeof vnode === 'string' || typeof vnode === 'number') {
		return node.splitText !== undefined;
	}
	if (typeof vnode.nodeName === 'string') {
		return !node._componentConstructor && isNamedNode(node, vnode.nodeName);
	}
	return hydrating || node._componentConstructor === vnode.nodeName;
}

function isNamedNode(node, nodeName) {
	return node.normalizedNodeName === nodeName || node.nodeName.toLowerCase() === nodeName.toLowerCase();
}

function getNodeProps(vnode) {
	var props = extend({}, vnode.attributes);
	props.children = vnode.children;

	var defaultProps = vnode.nodeName.defaultProps;
	if (defaultProps !== undefined) {
		for (var i in defaultProps) {
			if (props[i] === undefined) {
				props[i] = defaultProps[i];
			}
		}
	}

	return props;
}

function createNode(nodeName, isSvg) {
	var node = isSvg ? document.createElementNS('http://www.w3.org/2000/svg', nodeName) : document.createElement(nodeName);
	node.normalizedNodeName = nodeName;
	return node;
}

function removeNode(node) {
	var parentNode = node.parentNode;
	if (parentNode) parentNode.removeChild(node);
}

function setAccessor(node, name, old, value, isSvg) {
	if (name === 'className') name = 'class';

	if (name === 'key') ; else if (name === 'ref') {
		if (old) old(null);
		if (value) value(node);
	} else if (name === 'class' && !isSvg) {
		node.className = value || '';
	} else if (name === 'style') {
		if (!value || typeof value === 'string' || typeof old === 'string') {
			node.style.cssText = value || '';
		}
		if (value && typeof value === 'object') {
			if (typeof old !== 'string') {
				for (var i in old) {
					if (!(i in value)) node.style[i] = '';
				}
			}
			for (var i in value) {
				node.style[i] = typeof value[i] === 'number' && IS_NON_DIMENSIONAL.test(i) === false ? value[i] + 'px' : value[i];
			}
		}
	} else if (name === 'dangerouslySetInnerHTML') {
		if (value) node.innerHTML = value.__html || '';
	} else if (name[0] == 'o' && name[1] == 'n') {
		var useCapture = name !== (name = name.replace(/Capture$/, ''));
		name = name.toLowerCase().substring(2);
		if (value) {
			if (!old) node.addEventListener(name, eventProxy, useCapture);
		} else {
			node.removeEventListener(name, eventProxy, useCapture);
		}
		(node._listeners || (node._listeners = {}))[name] = value;
	} else if (name !== 'list' && name !== 'type' && !isSvg && name in node) {
		try {
			node[name] = value == null ? '' : value;
		} catch (e) {}
		if ((value == null || value === false) && name != 'spellcheck') node.removeAttribute(name);
	} else {
		var ns = isSvg && name !== (name = name.replace(/^xlink:?/, ''));

		if (value == null || value === false) {
			if (ns) node.removeAttributeNS('http://www.w3.org/1999/xlink', name.toLowerCase());else node.removeAttribute(name);
		} else if (typeof value !== 'function') {
			if (ns) node.setAttributeNS('http://www.w3.org/1999/xlink', name.toLowerCase(), value);else node.setAttribute(name, value);
		}
	}
}

function eventProxy(e) {
	return this._listeners[e.type](options.event && options.event(e) || e);
}

var mounts = [];

var diffLevel = 0;

var isSvgMode = false;

var hydrating = false;

function flushMounts() {
	var c;
	while (c = mounts.pop()) {
		if (options.afterMount) options.afterMount(c);
		if (c.componentDidMount) c.componentDidMount();
	}
}

function diff(dom, vnode, context, mountAll, parent, componentRoot) {
	if (!diffLevel++) {
		isSvgMode = parent != null && parent.ownerSVGElement !== undefined;

		hydrating = dom != null && !('__preactattr_' in dom);
	}

	var ret = idiff(dom, vnode, context, mountAll, componentRoot);

	if (parent && ret.parentNode !== parent) parent.appendChild(ret);

	if (! --diffLevel) {
		hydrating = false;

		if (!componentRoot) flushMounts();
	}

	return ret;
}

function idiff(dom, vnode, context, mountAll, componentRoot) {
	var out = dom,
	    prevSvgMode = isSvgMode;

	if (vnode == null || typeof vnode === 'boolean') vnode = '';

	if (typeof vnode === 'string' || typeof vnode === 'number') {
		if (dom && dom.splitText !== undefined && dom.parentNode && (!dom._component || componentRoot)) {
			if (dom.nodeValue != vnode) {
				dom.nodeValue = vnode;
			}
		} else {
			out = document.createTextNode(vnode);
			if (dom) {
				if (dom.parentNode) dom.parentNode.replaceChild(out, dom);
				recollectNodeTree(dom, true);
			}
		}

		out['__preactattr_'] = true;

		return out;
	}

	var vnodeName = vnode.nodeName;
	if (typeof vnodeName === 'function') {
		return buildComponentFromVNode(dom, vnode, context, mountAll);
	}

	isSvgMode = vnodeName === 'svg' ? true : vnodeName === 'foreignObject' ? false : isSvgMode;

	vnodeName = String(vnodeName);
	if (!dom || !isNamedNode(dom, vnodeName)) {
		out = createNode(vnodeName, isSvgMode);

		if (dom) {
			while (dom.firstChild) {
				out.appendChild(dom.firstChild);
			}
			if (dom.parentNode) dom.parentNode.replaceChild(out, dom);

			recollectNodeTree(dom, true);
		}
	}

	var fc = out.firstChild,
	    props = out['__preactattr_'],
	    vchildren = vnode.children;

	if (props == null) {
		props = out['__preactattr_'] = {};
		for (var a = out.attributes, i = a.length; i--;) {
			props[a[i].name] = a[i].value;
		}
	}

	if (!hydrating && vchildren && vchildren.length === 1 && typeof vchildren[0] === 'string' && fc != null && fc.splitText !== undefined && fc.nextSibling == null) {
		if (fc.nodeValue != vchildren[0]) {
			fc.nodeValue = vchildren[0];
		}
	} else if (vchildren && vchildren.length || fc != null) {
		innerDiffNode(out, vchildren, context, mountAll, hydrating || props.dangerouslySetInnerHTML != null);
	}

	diffAttributes(out, vnode.attributes, props);

	isSvgMode = prevSvgMode;

	return out;
}

function innerDiffNode(dom, vchildren, context, mountAll, isHydrating) {
	var originalChildren = dom.childNodes,
	    children = [],
	    keyed = {},
	    keyedLen = 0,
	    min = 0,
	    len = originalChildren.length,
	    childrenLen = 0,
	    vlen = vchildren ? vchildren.length : 0,
	    j,
	    c,
	    f,
	    vchild,
	    child;

	if (len !== 0) {
		for (var i = 0; i < len; i++) {
			var _child = originalChildren[i],
			    props = _child['__preactattr_'],
			    key = vlen && props ? _child._component ? _child._component.__key : props.key : null;
			if (key != null) {
				keyedLen++;
				keyed[key] = _child;
			} else if (props || (_child.splitText !== undefined ? isHydrating ? _child.nodeValue.trim() : true : isHydrating)) {
				children[childrenLen++] = _child;
			}
		}
	}

	if (vlen !== 0) {
		for (var i = 0; i < vlen; i++) {
			vchild = vchildren[i];
			child = null;

			var key = vchild.key;
			if (key != null) {
				if (keyedLen && keyed[key] !== undefined) {
					child = keyed[key];
					keyed[key] = undefined;
					keyedLen--;
				}
			} else if (min < childrenLen) {
				for (j = min; j < childrenLen; j++) {
					if (children[j] !== undefined && isSameNodeType(c = children[j], vchild, isHydrating)) {
						child = c;
						children[j] = undefined;
						if (j === childrenLen - 1) childrenLen--;
						if (j === min) min++;
						break;
					}
				}
			}

			child = idiff(child, vchild, context, mountAll);

			f = originalChildren[i];
			if (child && child !== dom && child !== f) {
				if (f == null) {
					dom.appendChild(child);
				} else if (child === f.nextSibling) {
					removeNode(f);
				} else {
					dom.insertBefore(child, f);
				}
			}
		}
	}

	if (keyedLen) {
		for (var i in keyed) {
			if (keyed[i] !== undefined) recollectNodeTree(keyed[i], false);
		}
	}

	while (min <= childrenLen) {
		if ((child = children[childrenLen--]) !== undefined) recollectNodeTree(child, false);
	}
}

function recollectNodeTree(node, unmountOnly) {
	var component = node._component;
	if (component) {
		unmountComponent(component);
	} else {
		if (node['__preactattr_'] != null && node['__preactattr_'].ref) node['__preactattr_'].ref(null);

		if (unmountOnly === false || node['__preactattr_'] == null) {
			removeNode(node);
		}

		removeChildren(node);
	}
}

function removeChildren(node) {
	node = node.lastChild;
	while (node) {
		var next = node.previousSibling;
		recollectNodeTree(node, true);
		node = next;
	}
}

function diffAttributes(dom, attrs, old) {
	var name;

	for (name in old) {
		if (!(attrs && attrs[name] != null) && old[name] != null) {
			setAccessor(dom, name, old[name], old[name] = undefined, isSvgMode);
		}
	}

	for (name in attrs) {
		if (name !== 'children' && name !== 'innerHTML' && (!(name in old) || attrs[name] !== (name === 'value' || name === 'checked' ? dom[name] : old[name]))) {
			setAccessor(dom, name, old[name], old[name] = attrs[name], isSvgMode);
		}
	}
}

var recyclerComponents = [];

function createComponent(Ctor, props, context) {
	var inst,
	    i = recyclerComponents.length;

	if (Ctor.prototype && Ctor.prototype.render) {
		inst = new Ctor(props, context);
		Component.call(inst, props, context);
	} else {
		inst = new Component(props, context);
		inst.constructor = Ctor;
		inst.render = doRender;
	}

	while (i--) {
		if (recyclerComponents[i].constructor === Ctor) {
			inst.nextBase = recyclerComponents[i].nextBase;
			recyclerComponents.splice(i, 1);
			return inst;
		}
	}

	return inst;
}

function doRender(props, state, context) {
	return this.constructor(props, context);
}

function setComponentProps(component, props, renderMode, context, mountAll) {
	if (component._disable) return;
	component._disable = true;

	component.__ref = props.ref;
	component.__key = props.key;
	delete props.ref;
	delete props.key;

	if (typeof component.constructor.getDerivedStateFromProps === 'undefined') {
		if (!component.base || mountAll) {
			if (component.componentWillMount) component.componentWillMount();
		} else if (component.componentWillReceiveProps) {
			component.componentWillReceiveProps(props, context);
		}
	}

	if (context && context !== component.context) {
		if (!component.prevContext) component.prevContext = component.context;
		component.context = context;
	}

	if (!component.prevProps) component.prevProps = component.props;
	component.props = props;

	component._disable = false;

	if (renderMode !== 0) {
		if (renderMode === 1 || options.syncComponentUpdates !== false || !component.base) {
			renderComponent(component, 1, mountAll);
		} else {
			enqueueRender(component);
		}
	}

	if (component.__ref) component.__ref(component);
}

function renderComponent(component, renderMode, mountAll, isChild) {
	if (component._disable) return;

	var props = component.props,
	    state = component.state,
	    context = component.context,
	    previousProps = component.prevProps || props,
	    previousState = component.prevState || state,
	    previousContext = component.prevContext || context,
	    isUpdate = component.base,
	    nextBase = component.nextBase,
	    initialBase = isUpdate || nextBase,
	    initialChildComponent = component._component,
	    skip = false,
	    snapshot = previousContext,
	    rendered,
	    inst,
	    cbase;

	if (component.constructor.getDerivedStateFromProps) {
		state = extend(extend({}, state), component.constructor.getDerivedStateFromProps(props, state));
		component.state = state;
	}

	if (isUpdate) {
		component.props = previousProps;
		component.state = previousState;
		component.context = previousContext;
		if (renderMode !== 2 && component.shouldComponentUpdate && component.shouldComponentUpdate(props, state, context) === false) {
			skip = true;
		} else if (component.componentWillUpdate) {
			component.componentWillUpdate(props, state, context);
		}
		component.props = props;
		component.state = state;
		component.context = context;
	}

	component.prevProps = component.prevState = component.prevContext = component.nextBase = null;
	component._dirty = false;

	if (!skip) {
		rendered = component.render(props, state, context);

		if (component.getChildContext) {
			context = extend(extend({}, context), component.getChildContext());
		}

		if (isUpdate && component.getSnapshotBeforeUpdate) {
			snapshot = component.getSnapshotBeforeUpdate(previousProps, previousState);
		}

		var childComponent = rendered && rendered.nodeName,
		    toUnmount,
		    base;

		if (typeof childComponent === 'function') {

			var childProps = getNodeProps(rendered);
			inst = initialChildComponent;

			if (inst && inst.constructor === childComponent && childProps.key == inst.__key) {
				setComponentProps(inst, childProps, 1, context, false);
			} else {
				toUnmount = inst;

				component._component = inst = createComponent(childComponent, childProps, context);
				inst.nextBase = inst.nextBase || nextBase;
				inst._parentComponent = component;
				setComponentProps(inst, childProps, 0, context, false);
				renderComponent(inst, 1, mountAll, true);
			}

			base = inst.base;
		} else {
			cbase = initialBase;

			toUnmount = initialChildComponent;
			if (toUnmount) {
				cbase = component._component = null;
			}

			if (initialBase || renderMode === 1) {
				if (cbase) cbase._component = null;
				base = diff(cbase, rendered, context, mountAll || !isUpdate, initialBase && initialBase.parentNode, true);
			}
		}

		if (initialBase && base !== initialBase && inst !== initialChildComponent) {
			var baseParent = initialBase.parentNode;
			if (baseParent && base !== baseParent) {
				baseParent.replaceChild(base, initialBase);

				if (!toUnmount) {
					initialBase._component = null;
					recollectNodeTree(initialBase, false);
				}
			}
		}

		if (toUnmount) {
			unmountComponent(toUnmount);
		}

		component.base = base;
		if (base && !isChild) {
			var componentRef = component,
			    t = component;
			while (t = t._parentComponent) {
				(componentRef = t).base = base;
			}
			base._component = componentRef;
			base._componentConstructor = componentRef.constructor;
		}
	}

	if (!isUpdate || mountAll) {
		mounts.unshift(component);
	} else if (!skip) {

		if (component.componentDidUpdate) {
			component.componentDidUpdate(previousProps, previousState, snapshot);
		}
		if (options.afterUpdate) options.afterUpdate(component);
	}

	while (component._renderCallbacks.length) {
		component._renderCallbacks.pop().call(component);
	}if (!diffLevel && !isChild) flushMounts();
}

function buildComponentFromVNode(dom, vnode, context, mountAll) {
	var c = dom && dom._component,
	    originalComponent = c,
	    oldDom = dom,
	    isDirectOwner = c && dom._componentConstructor === vnode.nodeName,
	    isOwner = isDirectOwner,
	    props = getNodeProps(vnode);
	while (c && !isOwner && (c = c._parentComponent)) {
		isOwner = c.constructor === vnode.nodeName;
	}

	if (c && isOwner && (!mountAll || c._component)) {
		setComponentProps(c, props, 3, context, mountAll);
		dom = c.base;
	} else {
		if (originalComponent && !isDirectOwner) {
			unmountComponent(originalComponent);
			dom = oldDom = null;
		}

		c = createComponent(vnode.nodeName, props, context);
		if (dom && !c.nextBase) {
			c.nextBase = dom;

			oldDom = null;
		}
		setComponentProps(c, props, 1, context, mountAll);
		dom = c.base;

		if (oldDom && dom !== oldDom) {
			oldDom._component = null;
			recollectNodeTree(oldDom, false);
		}
	}

	return dom;
}

function unmountComponent(component) {
	if (options.beforeUnmount) options.beforeUnmount(component);

	var base = component.base;

	component._disable = true;

	if (component.componentWillUnmount) component.componentWillUnmount();

	component.base = null;

	var inner = component._component;
	if (inner) {
		unmountComponent(inner);
	} else if (base) {
		if (base['__preactattr_'] && base['__preactattr_'].ref) base['__preactattr_'].ref(null);

		component.nextBase = base;

		removeNode(base);
		recyclerComponents.push(component);

		removeChildren(base);
	}

	if (component.__ref) component.__ref(null);
}

function Component(props, context) {
	this._dirty = true;

	this.context = context;

	this.props = props;

	this.state = this.state || {};

	this._renderCallbacks = [];
}

extend(Component.prototype, {
	setState: function setState(state, callback) {
		var prev = this.prevState = this.state;
		if (typeof state === 'function') state = state(prev, this.props);
		this.state = extend(extend({}, prev), state);
		if (callback) this._renderCallbacks.push(callback);
		enqueueRender(this);
	},
	forceUpdate: function forceUpdate(callback) {
		if (callback) this._renderCallbacks.push(callback);
		renderComponent(this, 2);
	},
	render: function render() {}
});

function render(vnode, parent, merge) {
	return diff(merge, vnode, {}, false, parent, false);
}

var preact = {
	h: h,
	createElement: h,
	cloneElement: cloneElement,
	Component: Component,
	render: render,
	rerender: rerender,
	options: options
};

var preact$1 = /*#__PURE__*/Object.freeze({
	default: preact,
	h: h,
	createElement: h,
	cloneElement: cloneElement,
	Component: Component,
	render: render,
	rerender: rerender,
	options: options
});

function unwrapExports (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x.default : x;
}

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

function getCjsExportFromNamespace (n) {
	return n && n.default || n;
}

var preact$2 = getCjsExportFromNamespace(preact$1);

var preactClasslessComponent = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  var _extends = Object.assign || function (target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }return target;
  };

  exports.default = function (obj) {
    function preactComponent() {
      preact$2.Component.apply(this, arguments);

      // auto-bind methods to the component
      for (var i in obj) {
        if (i !== 'render' && typeof obj[i] === 'function') {
          this[i] = obj[i].bind(this);
        }
      }

      if (obj.init) {
        obj.init.call(this);
      }
    }

    preactComponent.prototype = _extends(Object.create(preact$2.Component.prototype), obj);

    preactComponent.prototype.constructor = preactComponent;

    return preactComponent;
  };

  module.exports = exports['default'];
});

unwrapExports(preactClasslessComponent);

var containers = []; // will store container HTMLElement references
var styleElements = []; // will store {prepend: HTMLElement, append: HTMLElement}

var usage = 'insert-css: You need to provide a CSS string. Usage: insertCss(cssString[, options]).';

function insertCss(css, options) {
    options = options || {};

    if (css === undefined) {
        throw new Error(usage);
    }

    var position = options.prepend === true ? 'prepend' : 'append';
    var container = options.container !== undefined ? options.container : document.querySelector('head');
    var containerId = containers.indexOf(container);

    // first time we see this container, create the necessary entries
    if (containerId === -1) {
        containerId = containers.push(container) - 1;
        styleElements[containerId] = {};
    }

    // try to get the correponding container + position styleElement, create it otherwise
    var styleElement;

    if (styleElements[containerId] !== undefined && styleElements[containerId][position] !== undefined) {
        styleElement = styleElements[containerId][position];
    } else {
        styleElement = styleElements[containerId][position] = createStyleElement();

        if (position === 'prepend') {
            container.insertBefore(styleElement, container.childNodes[0]);
        } else {
            container.appendChild(styleElement);
        }
    }

    // strip potential UTF-8 BOM if css was read from a file
    if (css.charCodeAt(0) === 0xFEFF) {
        css = css.substr(1, css.length);
    }

    // actually add the stylesheet
    if (styleElement.styleSheet) {
        styleElement.styleSheet.cssText += css;
    } else {
        styleElement.textContent += css;
    }

    return styleElement;
}
function createStyleElement() {
    var styleElement = document.createElement('style');
    styleElement.setAttribute('type', 'text/css');
    return styleElement;
}

var insertCss_1 = insertCss;
var insertCss_2 = insertCss;
insertCss_1.insertCss = insertCss_2;

var getElementHeight = function getElementHeight(el) {
  var elStyle = window.getComputedStyle(el);
  var elDisplay = elStyle.display;
  var elPosition = elStyle.position;
  var elVisibility = elStyle.visibility;
  var elMaxHeight = elStyle.maxHeight;
  var elMaxHeightNumber = elMaxHeight.replace('px', '').replace('%', '');
  var computedHeight = 0;

  if (elDisplay !== 'none' && elMaxHeightNumber !== '0') {
    return el.offsetHeight;
  }

  el.style.maxHeight = '';
  el.style.position = 'absolute';
  el.style.visibility = 'hidden';
  el.style.display = 'block';

  computedHeight = el.offsetHeight;

  el.style.maxHeight = elMaxHeight;
  el.style.display = elDisplay;
  el.style.position = elPosition;
  el.style.visibility = elVisibility;

  return computedHeight;
};

var toggleSlide = function toggleSlide(el, callback) {
  var elMaxHeightNumber = el.style.maxHeight.replace('px', '').replace('%', '');

  if (elMaxHeightNumber === '0') {
    var maxComputedHeight = getElementHeight(el) + 'px';

    el.style.transition = 'max-height 0.1s ease-in-out';
    el.style.overflowY = 'hidden';
    el.style.maxHeight = '0';
    el.style.display = 'block';

    var restore = function () {
      el.style.transition = 'none';
      el.style.overflowY = 'visible';
      el.style.maxHeight = '';
      el.removeEventListener('transitionend', restore);
      callback && callback();
    };

    el.addEventListener('transitionend', restore);

    setTimeout(function () {
      el.style.maxHeight = maxComputedHeight;
    }, 10);
  } else {
    var maxComputedHeight = getElementHeight(el) + 'px';

    el.style.transition = 'max-height 0.1s ease-in-out';
    el.style.overflowY = 'hidden';
    el.style.maxHeight = maxComputedHeight;
    el.style.display = 'block';

    var restore = function () {
      el.style.transition = 'none';
      el.removeEventListener('transitionend', restore);
      callback && callback();
    };
    el.addEventListener('transitionend', restore);

    setTimeout(function () {
      el.style.maxHeight = '0';
    }, 10);
  }
};

var gui = createGui;

function createGui(state, opts) {
  opts = opts || {};

  var style = opts.style === undefined ? true : !!opts.style;

  var className = opts.className === undefined ? 'controlPanel' : opts.className;
  var h = preact$2.h;
  var render = preact$2.render;

  var Section = preactClasslessComponent({
    init: function () {
      var expanded = this.props.field.$config.expanded;
      expanded = expanded === undefined ? true : !!expanded;
      this.state = {
        expanded: expanded
      };
    },
    toggleCollapsed: function (event) {
      event.stopPropagation();

      toggleSlide(this.contentsEl);

      this.setState({ expanded: !this.state.expanded });
    },
    getRef: function (ref) {
      this.contentsEl = ref;
      if (this.state.expanded === false) {
        toggleSlide(this.contentsEl);
      }
    },
    render: function () {
      var field = this.props.field;
      var config = field.$config;
      var title = config.label || field.name;
      if (!field.parentField && title === '') title = 'Controls';
      return h('fieldset', {
        className: className + '__section ' + (this.state.expanded ? className + '__section--expanded' : '')
      }, h('legend', {
        className: className + '__sectionHeading'
      }, h('button', { onClick: this.toggleCollapsed }, title)), h('div', {
        ref: this.getRef,
        className: className + '__sectionFields'
      }, Object.keys(field.value.$displayFields).map(function (key) {
        return h(Control, { field: field.value.$path[key].$field });
      })));
    }
  });

  var Select = preactClasslessComponent({
    render: function () {
      var _this = this;

      var field = this.props.field;
      var config = field.$config;
      return h('div', {
        className: className + '__field ' + className + '__field--select'
      }, h('label', { htmlFor: field.path }, h('span', null, config.label || field.name)), ' ', h('span', { className: className + '__container' }, h('select', {
        name: field.path,
        id: field.path,
        onChange: function (event) {
          return _this.props.field.value = event.target.value;
        }
      }, field.options.map(function (option) {
        return h('option', {
          value: option,
          selected: option === field.value
        }, option);
      }))));
    }
  });

  var TextInput = preactClasslessComponent({
    render: function () {
      var _this2 = this;

      var field = this.props.field;
      var config = field.$config;
      return h('div', {
        className: className + '__field ' + className + '__field--text'
      }, h('label', { htmlFor: field.path }, h('span', null, config.label || field.name)), ' ', h('span', { className: className + '__container' }, h('input', {
        id: field.path,
        name: field.path,
        type: 'text',
        value: field.value,
        onInput: function (event) {
          return _this2.props.field.value = event.target.value;
        }
      })));
    }
  });

  var Checkbox = preactClasslessComponent({
    render: function () {
      var _this3 = this;

      var field = this.props.field;
      var config = field.$config;
      return h('div', {
        className: className + '__field ' + className + '__field--checkbox'
      }, h('label', { htmlFor: field.path }, h('span', null, config.label || field.name)), ' ', h('span', { className: className + '__container' }, h('input', {
        id: field.path,
        name: field.path,
        type: 'checkbox',
        checked: field.value,
        onInput: function (event) {
          return _this3.props.field.value = event.target.checked;
        }
      })));
    }
  });

  var Button = preactClasslessComponent({
    render: function () {
      var field = this.props.field;
      var config = field.$config;
      return h('div', {
        className: className + '__field ' + className + '__field--button'
      }, h('button', {
        onClick: field.value
      }, config.label || field.name));
    }
  });

  var Color = preactClasslessComponent({
    render: function () {
      var _this4 = this;

      var field = this.props.field;
      var config = field.$config;
      return h('div', {
        className: className + '__field ' + className + '__field--color'
      }, h('label', { htmlFor: field.path }, h('span', null, config.label || field.name)), ' ', h('span', { className: className + '__container' }, h('input', {
        id: field.path,
        name: field.path,
        type: 'color',
        value: field.value,
        onInput: function (event) {
          _this4.props.field.value = event.target.value;
        }
      })));
    }
  });

  var Slider = preactClasslessComponent({
    render: function () {
      var _this5 = this;

      var field = this.props.field;
      var config = field.$config;
      return h('div', {
        className: className + '__field ' + className + '__field--slider'
      }, h('label', { htmlFor: field.path }, h('span', null, config.label || field.name)), ' ', h('span', { className: className + '__container' }, h('input', {
        id: field.path,
        name: field.path,
        type: 'range',
        min: field.min,
        max: field.max,
        step: field.step,
        value: field.value,
        onInput: function (event) {
          return _this5.props.field.value = parseFloat(event.target.value);
        }
      }), h('span', { className: className + '__value' }, field.value.toFixed(4).replace(/\.?0*$/, ''))));
    }
  });

  var Control = preactClasslessComponent({
    render: function () {
      switch (this.props.field.type) {
        case 'raw':
          return h(Raw, { field: this.props.field });
        case 'button':
          return h(Button, { field: this.props.field });
        case 'checkbox':
          return h(Checkbox, { field: this.props.field });
        case 'color':
          return h(Color, { field: this.props.field });
        case 'textinput':
          return h(TextInput, { field: this.props.field });
        case 'slider':
          return h(Slider, { field: this.props.field });
        case 'select':
          return h(Select, { field: this.props.field });
        case 'section':
          return h(Section, { field: this.props.field });
        default:
          throw new Error('Unknown field type, "' + this.props.field.type + '"');
      }
    }
  });

  var Raw = preactClasslessComponent({
    getRef: function (el) {
      this.el = el;
    },

    getContent: function (props) {
      this.content = props.field.value;
      if (typeof this.content === 'function') {
        this.content = this.content(state, props.field.parent.value);
      }
      return this.content;
    },

    componentDidMount: function () {
      this.el.innerHTML = this.getContent(this.props);
    },

    componentWillReceiveProps: function (nextProps) {
      this.el.innerHTML = this.getContent(nextProps);
    },

    render: function () {
      return h('div', {
        className: className + '__field--raw ' + className + '__field'
      }, h('div', {
        ref: this.getRef,
        className: className + '__rawContent'
      }));
    }
  });

  var App = preactClasslessComponent({
    state: {
      dummy: 0
    },
    componentDidMount: function () {
      var _this6 = this;

      this.props.state.$field.onChanges(function (updates) {
        _this6.setState({ dummy: _this6.state.dummy + 1 });
      });
    },
    getRef: function (c) {
      var eventList = ['mousedown', 'mouseup', 'mousemove', 'touchstart', 'touchmove', 'touchend', 'wheel'];
      for (var i = 0; i < eventList.length; i++) {
        c.addEventListener(eventList[i], function (e) {
          e.stopPropagation();
        });
      }
    },
    render: function () {
      return h('div', {
        className: '' + className,
        ref: this.getRef
      }, h(Control, { field: this.props.state.$field }));
    }
  });

  if (style) {
    var SLIDER_HEIGHT = '22px';
    var CONTROL_BG_COLOR = '#444';
    var PANEL_BG_COLOR = '#333';
    var FIELD_HOVER_COLOR = '#383838';
    var SECTION_HEADING_BG_COLOR = '#222';
    var SECTION_HEADING_HOVER_COLOR = '#444';
    var DIVIDER_COLOR = '#232323';
    var CONTROL_BORDER_COLOR = '#555';
    var THUMB_COLOR = '#888';
    var TEXT_COLOR = '#e8e8e8';
    var SECTION_HEADING_HEIGHT = '24px';
    var MIN_LABEL_WIDTH = '110px';
    var MIN_CONTROL_WIDTH = '130px';

    var FOCUS_BORDER = '\n      outline: none;\n      border-color: #888;\n      box-shadow: 0 0 3px rgba(255, 255, 255, 0.5);\n    ';

    insertCss_1('\n      .' + className + ' {\n        color: ' + TEXT_COLOR + ';\n      }\n\n      .' + className + '__sectionHeading {\n        font-family: inherit;\n      }\n\n      .' + className + '__sectionHeading > button {\n        vertical-align: middle;\n        font-size: 1.0em;\n        cursor: pointer;\n        text-align: left;\n        outline: none;\n        color: inherit;\n        font-family: inherit;\n        background: transparent;\n        border: none;\n        border-radius: 0;\n        display: block;\n        width: 100%;\n      }\n\n      .' + className + ' a {\n        color: #cde;\n      }\n\n      .' + className + '__field {\n        position: relative;\n        height: 30px;\n        line-height: 31px;\n        display: flex;\n        flex-direction: row;\n        background-color: ' + PANEL_BG_COLOR + ';\n      }\n\n      .' + className + '__field:not(:first-child) {\n        border-top: 1px solid ' + DIVIDER_COLOR + ';\n      }\n\n      .' + className + '__field--raw {\n        height: auto;\n      }\n\n      .' + className + '__field:hover {\n        background-color: ' + FIELD_HOVER_COLOR + ';\n      }\n\n      .' + className + '__sectionHeading:hover {\n        background-color: ' + SECTION_HEADING_HOVER_COLOR + ';\n      }\n\n      .' + className + '__sectionHeading > button::before {\n        transform: translate(0, -1px) rotate(90deg);\n      }\n\n      .' + className + '__sectionHeading > button::before {\n        content: \'\u25B2\';\n        display: inline-block;\n        transform-origin: 50% 50%;\n        margin-right: 0.5em;\n        font-size: 0.5em;\n        vertical-align: middle;\n      }\n\n      .' + className + '__section--expanded > .' + className + '__sectionHeading > button::before {\n        transform: none;\n        content: \'\u25BC\';\n      }\n\n      .' + className + '__container {\n        display: flex;\n        flex-direction: row;\n        align-content: stretch;\n        justify-content: stretch;\n      \n        height: 30px;\n        flex: 1;\n        position: relative;\n        align-items: center;\n        position: relative;\n\n        min-width: ' + MIN_CONTROL_WIDTH + ';\n        width: 30px;\n        padding-right: 8px;\n        text-indent: 8px;\n      }\n\n      .' + className + '__value {\n        position: absolute;\n        pointer-events: none;\n        top: 0;\n        z-index: 11;\n        line-height: 31px;\n        height: 30px;\n        display: inline-block;\n        right: 15px;\n        text-shadow:  1px  0   rgba(0,0,0,0.3),\n                      0    1px rgba(0,0,0,0.3),\n                     -1px  0   rgba(0,0,0,0.3),\n                      0   -1px rgba(0,0,0,0.3),\n                      1px  1px rgba(0,0,0,0.3),\n                      1px -1px rgba(0,0,0,0.3),\n                     -1px  1px rgba(0,0,0,0.3),\n                     -1px -1px rgba(0,0,0,0.3);\n      }\n\n      .' + className + '__field--button button {\n        font-family: inherit;\n        outline: none;\n        cursor: pointer;\n        text-align: center;\n        display: block;\n        background: transparent;\n        color: inherit;\n        font-size: 1.0em;\n        width: 100%;\n        border: none;\n        border-radius: 0;\n      }\n\n      .' + className + '__field--button > button:hover {\n        background-color: #444;\n      }\n\n      .' + className + '__field--button > button:active {\n        background-color: #222;\n      }\n\n      .' + className + '__field--button > button:focus {\n        ' + FOCUS_BORDER + '\n      }\n\n      .' + className + '__field--raw {\n        padding: 5px 10px;\n      }\n\n      .' + className + '__rawContent {\n        max-width: calc(' + MIN_CONTROL_WIDTH + ' + ' + MIN_LABEL_WIDTH + ' + 10px);\n        margin: 0;\n        padding: 0;\n      }\n\n      .' + className + '__rawContent pre {\n        line-height: 1.3;\n        font-size: 0.8em;\n        margin: 0;\n      }\n\n      .' + className + '__rawContent > p:first-child {\n        margin-top: 5px;\n      }\n      .' + className + '__rawContent > p:last-child{\n        margin-bottom: 5px;\n      }\n\n      .' + className + '__sectionHeading {\n        margin-left: -4px;\n        user-select: none;\n        text-indent: 5px;\n        cursor: pointer;\n        width: 100%;\n        display: flex;\n\n        background-color: ' + SECTION_HEADING_BG_COLOR + ';\n        height: ' + SECTION_HEADING_HEIGHT + ';\n        line-height: ' + SECTION_HEADING_HEIGHT + ';\n      }\n\n      .' + className + '__section {\n        margin: 0;\n        padding: 0;\n        border: none;\n        margin-left: 4px;\n      }\n\n      .' + className + ' p {\n        line-height: 1.8;\n      }\n\n      .' + className + ' label {\n        user-select: none;\n        text-indent: 8px;\n        margin-right: 4px;\n        display: inline-block;\n        min-width: ' + MIN_LABEL_WIDTH + ';\n        line-height: 31px;\n      }\n\n      .' + className + ' label::before,\n      .' + className + '__field--button > button::before,\n      .' + className + '__rawContent::before {\n        content: \'\';\n        width: 3px;\n        background-color: red;\n        display: inline-block;\n        vertical-align: middle;\n        position: absolute;\n        top: 0;\n        left: 0;\n        bottom: 0;\n      }\n\n      .' + className + '__field--text label::before {\n        background-color: #49f;\n      }\n\n      .' + className + '__field--color label::before {\n        background-color: #94f;\n      }\n\n      .' + className + '__field--checkbox label::before {\n        background-color: #f49;\n      }\n\n      .' + className + '__field--slider label::before {\n        background-color: #f84;\n      }\n\n      .' + className + '__field--select label::before {\n        background-color: #8f4;\n      }\n\n      .' + className + '__rawContent::before {\n        background-color: #aaa;\n      }\n\n      .' + className + '__field--button > button::before {\n        background-color: #8ff;\n      }\n\n      .' + className + '__field input[type="text"] {\n        margin: 0;\n        padding: 0 5px;\n        border: none;\n        height: ' + SLIDER_HEIGHT + ';\n        border-radius: 2px;\n        background-color: ' + CONTROL_BG_COLOR + ';\n        border: 1px solid ' + CONTROL_BORDER_COLOR + ';\n        color: inherit;\n      }\n\n      .' + className + '__field input[type="checkbox"]:focus,\n      .' + className + '__field input[type="text"]:focus,\n      .' + className + '__field input[type="color"]:focus,\n      .' + className + ' select:focus {\n        ' + FOCUS_BORDER + '\n      }\n\n      .' + className + '__field input[type="color"] {\n        margin: 0;\n        border: 1px solid #aaa;\n        width: ' + SLIDER_HEIGHT + ';\n        height: ' + SLIDER_HEIGHT + ';\n        border-radius: 2px;\n        padding: 0;\n      }\n\n      .' + className + '__field input[type="color"]::-webkit-color-swatch-wrapper {\n        padding: 0px;\n        background-color: #888;\n      }\n\n      .' + className + '__field input[type="checkbox"] {\n        height: 20px;\n        width: 20px;\n        margin-bottom: 0.2em;\n      }\n\n      .' + className + '__field input[type="range"] {\n        cursor: resize-ew;\n        border: 1px solid ' + CONTROL_BORDER_COLOR + ';\n      }\n\n      .' + className + ' input,\n      .' + className + ' select {\n        width: 100%;\n        margin: .4rem;\n      }\n\n      .' + className + ' select {\n        background-color: ' + CONTROL_BG_COLOR + ';\n        color: inherit;\n        border: 1px solid ' + CONTROL_BORDER_COLOR + ';\n        height: ' + SLIDER_HEIGHT + ';\n        margin: 0;\n      }\n\n      .' + className + ' input[type=range] {\n        -webkit-appearance: none;\n        vertical-align: middle;\n        border-radius: 2px;\n      }\n\n      .' + className + ' input[type=range]::-webkit-slider-runnable-track {\n        height: ' + SLIDER_HEIGHT + ';\n        cursor: ew-resize;\n        background: ' + CONTROL_BG_COLOR + ';\n      }\n\n      .' + className + ' input[type=range]::-webkit-slider-thumb {\n        height: ' + SLIDER_HEIGHT + ';\n        width: ' + SLIDER_HEIGHT + ';\n        background: ' + THUMB_COLOR + ';\n        cursor: ew-resize;\n        -webkit-appearance: none;\n        margin-top: 0px;\n      }\n\n      .' + className + ' input[type=range]:focus::-webkit-slider-runnable-track {\n        background: ' + CONTROL_BG_COLOR + ';\n        ' + FOCUS_BORDER + '\n      }\n\n      .' + className + ' input[type=range]::-moz-range-track {\n        height: ' + SLIDER_HEIGHT + ';\n        cursor: ew-resize;\n        background: ' + CONTROL_BG_COLOR + ';\n      }\n\n      .' + className + ' input[type=range]::-moz-range-thumb {\n        height: ' + SLIDER_HEIGHT + ';\n        width: 10px;\n        background: ' + THUMB_COLOR + ';\n        cursor: ew-resize;\n      }\n\n      .' + className + ' input[type=range]::-ms-track {\n        height: ' + SLIDER_HEIGHT + ';\n        cursor: ew-resize;\n        background: transparent;\n        border-color: transparent;\n        color: transparent;\n      }\n\n      .' + className + ' input[type=range]::-ms-fill-lower {\n        background: ' + CONTROL_BG_COLOR + ';\n      }\n\n      .' + className + ' input[type=range]::-ms-fill-upper {\n        background: ' + CONTROL_BG_COLOR + ';\n      }\n\n      .' + className + ' input[type=range]::-ms-thumb {\n        width: 10px;\n        border-radius: 0;\n        background: ' + THUMB_COLOR + ';\n        cursor: ew-resize;\n        height: ' + SLIDER_HEIGHT + ';\n      }\n\n      .' + className + ' input[type=range]:focus::-ms-fill-lower {\n        background: ' + CONTROL_BG_COLOR + ';\n        ' + FOCUS_BORDER + '\n      }\n\n      .' + className + ' input[type=range]:focus::-ms-fill-upper {\n        background: ' + CONTROL_BG_COLOR + ';\n        ' + FOCUS_BORDER + '\n      }\n\n      .' + className + ' input[type=range] {\n        -webkit-appearance: none;\n        margin: 0;\n      }\n\n      .' + className + ' input[type=range]:focus {\n        ' + FOCUS_BORDER + '\n      }\n\n      .' + className + ' input[type=range]::-webkit-slider-runnable-track {\n        height: ' + SLIDER_HEIGHT + ';\n        cursor: ew-resize;\n        background: ' + CONTROL_BG_COLOR + ';\n      }\n    ');
  }

  render(h(App, {
    state: state.$field.value
  }), opts.root || document.body);

  return state.$field.value;
}

module.exports = gui;