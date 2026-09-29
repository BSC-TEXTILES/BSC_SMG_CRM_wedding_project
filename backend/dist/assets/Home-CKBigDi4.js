import{A as vl,j as S}from"./index-C_jDH-B6.js";import{r as at,L as Ft}from"./vendor-react-CN2uBQDK.js";import{U as Sl,c as Ml,A as _o,X as bl,M as El,d as Ri,e as yl,S as jr,f as Tl,g as vo,h as So,i as wl,j as Al,k as Kr,a as Cl,P as Rl,l as Pl,m as Nl,N as Ll,n as Mo,H as Dl,o as Il,p as Ul,B as Fl,q as Ol}from"./vendor-icons-CiyKzSeV.js";var xa="1.3.26";function bo(i,e,t){return Math.max(i,Math.min(e,t))}function Bl(i,e,t){return(1-t)*i+t*e}function zl(i,e,t,n){return Bl(i,e,1-Math.exp(-t*n))}function kl(i,e){return(i%e+e)%e}var Hl=class{isRunning=!1;value=0;from=0;to=0;currentTime=0;lerp;duration;easing;onUpdate;advance(i){if(!this.isRunning)return;let e=!1;if(this.duration&&this.easing){this.currentTime+=i;const t=bo(0,this.currentTime/this.duration,1);e=t>=1;const n=e?1:this.easing(t);this.value=this.from+(this.to-this.from)*n}else this.lerp?(this.value=zl(this.value,this.to,this.lerp*60,i),Math.round(this.value)===Math.round(this.to)&&(this.value=this.to,e=!0)):(this.value=this.to,e=!0);e&&this.stop(),this.onUpdate?.(this.value,e)}stop(){this.isRunning=!1}fromTo(i,e,{lerp:t,duration:n,easing:s,onStart:r,onUpdate:a}){this.from=this.value=i,this.to=e,this.lerp=t,this.duration=n,this.easing=s,this.currentTime=0,this.isRunning=!0,r?.(),this.onUpdate=a}};function Gl(i,e){let t;return function(...n){clearTimeout(t),t=setTimeout(()=>{t=void 0,i.apply(this,n)},e)}}var Vl=class{width=0;height=0;scrollHeight=0;scrollWidth=0;debouncedResize;wrapperResizeObserver;contentResizeObserver;constructor(i,e,{autoResize:t=!0,debounce:n=250}={}){this.wrapper=i,this.content=e,t&&(this.debouncedResize=Gl(this.resize,n),this.wrapper instanceof Window?window.addEventListener("resize",this.debouncedResize):(this.wrapperResizeObserver=new ResizeObserver(this.debouncedResize),this.wrapperResizeObserver.observe(this.wrapper)),this.contentResizeObserver=new ResizeObserver(this.debouncedResize),this.contentResizeObserver.observe(this.content)),this.resize()}destroy(){this.wrapperResizeObserver?.disconnect(),this.contentResizeObserver?.disconnect(),this.wrapper===window&&this.debouncedResize&&window.removeEventListener("resize",this.debouncedResize)}resize=()=>{this.onWrapperResize(),this.onContentResize()};onWrapperResize=()=>{this.wrapper instanceof Window?(this.width=window.innerWidth,this.height=window.innerHeight):(this.width=this.wrapper.clientWidth,this.height=this.wrapper.clientHeight)};onContentResize=()=>{this.wrapper instanceof Window?(this.scrollHeight=this.content.scrollHeight,this.scrollWidth=this.content.scrollWidth):(this.scrollHeight=this.wrapper.scrollHeight,this.scrollWidth=this.wrapper.scrollWidth)};get limit(){return{x:this.scrollWidth-this.width,y:this.scrollHeight-this.height}}},Eo=class{events={};emit(i,...e){const t=this.events[i]||[];for(let n=0,s=t.length;n<s;n++)t[n]?.(...e)}on(i,e){return this.events[i]?this.events[i].push(e):this.events[i]=[e],()=>{this.events[i]=this.events[i]?.filter(t=>e!==t)}}off(i,e){this.events[i]=this.events[i]?.filter(t=>e!==t)}destroy(){this.events={}}};const Wl=100/6,En={passive:!1};function _a(i,e){return i===1?Wl:i===2?e:1}var Xl=class{touchStart={x:0,y:0};lastDelta={x:0,y:0};window={width:0,height:0};emitter=new Eo;constructor(i,e={wheelMultiplier:1,touchMultiplier:1}){this.element=i,this.options=e,window.addEventListener("resize",this.onWindowResize),this.onWindowResize(),this.element.addEventListener("wheel",this.onWheel,En),this.element.addEventListener("touchstart",this.onTouchStart,En),this.element.addEventListener("touchmove",this.onTouchMove,En),this.element.addEventListener("touchend",this.onTouchEnd,En)}on(i,e){return this.emitter.on(i,e)}destroy(){this.emitter.destroy(),window.removeEventListener("resize",this.onWindowResize),this.element.removeEventListener("wheel",this.onWheel,En),this.element.removeEventListener("touchstart",this.onTouchStart,En),this.element.removeEventListener("touchmove",this.onTouchMove,En),this.element.removeEventListener("touchend",this.onTouchEnd,En)}onTouchStart=i=>{const{clientX:e,clientY:t}=i.targetTouches?i.targetTouches[0]:i;this.touchStart.x=e,this.touchStart.y=t,this.lastDelta={x:0,y:0},this.emitter.emit("scroll",{deltaX:0,deltaY:0,event:i})};onTouchMove=i=>{const{clientX:e,clientY:t}=i.targetTouches?i.targetTouches[0]:i,n=-(e-this.touchStart.x)*this.options.touchMultiplier,s=-(t-this.touchStart.y)*this.options.touchMultiplier;this.touchStart.x=e,this.touchStart.y=t,this.lastDelta={x:n,y:s},this.emitter.emit("scroll",{deltaX:n,deltaY:s,event:i})};onTouchEnd=i=>{this.emitter.emit("scroll",{deltaX:this.lastDelta.x,deltaY:this.lastDelta.y,event:i})};onWheel=i=>{let{deltaX:e,deltaY:t,deltaMode:n}=i;const s=_a(n,this.window.width),r=_a(n,this.window.height);e*=s,t*=r,e*=this.options.wheelMultiplier,t*=this.options.wheelMultiplier,this.emitter.emit("scroll",{deltaX:e,deltaY:t,event:i})};onWindowResize=()=>{this.window={width:window.innerWidth,height:window.innerHeight}}};const va=i=>Math.min(1,1.001-2**(-10*i));var ql=class{_isScrolling=!1;_isStopped=!1;_isLocked=!1;_preventNextNativeScrollEvent=!1;_resetVelocityTimeout=null;_rafId=null;_isDraggingSelection=!1;reducedMotionMediaQuery=window.matchMedia("(prefers-reduced-motion: reduce)");isTouching;isIos;time=0;userData={};lastVelocity=0;velocity=0;direction=0;options;targetScroll;animatedScroll;animate=new Hl;emitter=new Eo;dimensions;virtualScroll;constructor({wrapper:i=window,content:e=document.documentElement,eventsTarget:t=i,smoothWheel:n=!0,syncTouch:s=!1,syncTouchLerp:r=.075,touchInertiaExponent:a=1.7,duration:o,easing:l,lerp:c=.1,infinite:u=!1,orientation:p="vertical",gestureOrientation:d=p==="horizontal"?"both":"vertical",touchMultiplier:g=1,wheelMultiplier:x=1,autoResize:b=!0,prevent:m,virtualScroll:h,overscroll:A=!0,autoRaf:P=!1,anchors:M=!1,autoToggle:T=!1,allowNestedScroll:E=!1,__experimental__naiveDimensions:C=!1,naiveDimensions:v=C,stopInertiaOnNavigate:w=!1,respectReducedMotion:D=!0}={}){window.lenisVersion=xa,window.lenis||(window.lenis={}),window.lenis.version=xa,p==="horizontal"&&(window.lenis.horizontal=!0),s===!0&&(window.lenis.touch=!0),this.isIos=/(iPad|iPhone|iPod)/g.test(navigator.userAgent),(!i||i===document.documentElement)&&(i=window),typeof o=="number"&&typeof l!="function"?l=va:typeof l=="function"&&typeof o!="number"&&(o=1),this.options={wrapper:i,content:e,eventsTarget:t,smoothWheel:n,syncTouch:s,syncTouchLerp:r,touchInertiaExponent:a,duration:o,easing:l,lerp:c,infinite:u,gestureOrientation:d,orientation:p,touchMultiplier:g,wheelMultiplier:x,autoResize:b,prevent:m,virtualScroll:h,overscroll:A,autoRaf:P,anchors:M,autoToggle:T,allowNestedScroll:E,naiveDimensions:v,stopInertiaOnNavigate:w,respectReducedMotion:D},this.dimensions=new Vl(i,e,{autoResize:b}),this.updateClassName(),this.targetScroll=this.animatedScroll=this.actualScroll,this.options.wrapper.addEventListener("scroll",this.onNativeScroll),this.options.wrapper.addEventListener("scrollend",this.onScrollEnd,{capture:!0}),(this.options.anchors||this.options.stopInertiaOnNavigate)&&this.options.wrapper.addEventListener("click",this.onClick),this.options.wrapper.addEventListener("pointerdown",this.onPointerDown),this.virtualScroll=new Xl(t,{touchMultiplier:g,wheelMultiplier:x}),this.virtualScroll.on("scroll",this.onVirtualScroll),this.options.autoToggle&&(this.checkOverflow(),this.rootElement.addEventListener("transitionend",this.onTransitionEnd)),this.options.autoRaf&&(this._rafId=requestAnimationFrame(this.raf))}destroy(){this.emitter.destroy(),this.options.wrapper.removeEventListener("scroll",this.onNativeScroll),this.options.wrapper.removeEventListener("scrollend",this.onScrollEnd,{capture:!0}),this.options.wrapper.removeEventListener("pointerdown",this.onPointerDown),(this.options.anchors||this.options.stopInertiaOnNavigate)&&this.options.wrapper.removeEventListener("click",this.onClick),this.virtualScroll.destroy(),this.dimensions.destroy(),this.cleanUpClassName(),this._rafId&&cancelAnimationFrame(this._rafId)}on(i,e){return this.emitter.on(i,e)}off(i,e){return this.emitter.off(i,e)}onScrollEnd=i=>{i instanceof CustomEvent||(this.isScrolling==="smooth"||this.isScrolling===!1)&&i.stopPropagation()};dispatchScrollendEvent=()=>{this.options.wrapper.dispatchEvent(new CustomEvent("scrollend",{bubbles:this.options.wrapper===window,detail:{lenisScrollEnd:!0}}))};get overflow(){const i=this.isHorizontal?"overflow-x":"overflow-y";return getComputedStyle(this.rootElement)[i]}checkOverflow(){["hidden","clip"].includes(this.overflow)?this.internalStop():this.internalStart()}onTransitionEnd=i=>{i.propertyName?.includes("overflow")&&i.target===this.rootElement&&this.checkOverflow()};setScroll(i){this.isHorizontal?this.options.wrapper.scrollTo({left:i,behavior:"instant"}):this.options.wrapper.scrollTo({top:i,behavior:"instant"})}onClick=i=>{const e=i.composedPath().filter(n=>n instanceof HTMLAnchorElement&&n.href).map(n=>new URL(n.href)),t=new URL(window.location.href);if(this.options.anchors){const n=e.find(s=>t.host===s.host&&t.pathname===s.pathname&&s.hash);if(n){const s=typeof this.options.anchors=="object"&&this.options.anchors?this.options.anchors:void 0,r=decodeURIComponent(n.hash);this.scrollTo(r,s);return}}if(this.options.stopInertiaOnNavigate&&e.some(n=>t.host===n.host&&t.pathname!==n.pathname)){this.reset();return}};onPointerDown=i=>{i.button===1&&this.reset()};isTouchOnSelectionHandle(i){const e=window.getSelection();if(!e||e.isCollapsed||e.rangeCount===0)return!1;const t=i.targetTouches[0]??i.changedTouches[0];if(!t)return!1;const n=e.getRangeAt(0).getClientRects();if(n.length===0)return!1;const s=n[0],r=n[n.length-1],a=40,o=Math.hypot(t.clientX-s.left,t.clientY-s.top)<=a,l=Math.hypot(t.clientX-r.right,t.clientY-r.bottom)<=a;return o||l}onVirtualScroll=i=>{if(typeof this.options.virtualScroll=="function"&&this.options.virtualScroll(i)===!1)return;const{deltaX:e,deltaY:t,event:n}=i;if(this.emitter.emit("virtual-scroll",{deltaX:e,deltaY:t,event:n}),n.ctrlKey||n.lenisStopPropagation)return;const s=n.type.includes("touch"),r=n.type.includes("wheel");if(s&&this.isIos&&(n.type==="touchstart"&&(this._isDraggingSelection=this.isTouchOnSelectionHandle(n)),this._isDraggingSelection)){n.type==="touchend"&&(this._isDraggingSelection=!1);return}this.isTouching=n.type==="touchstart"||n.type==="touchmove";const a=e===0&&t===0;if(this.options.syncTouch&&s&&n.type==="touchstart"&&a&&!this.isStopped&&!this.isLocked){this.reset();return}const o=this.options.gestureOrientation==="vertical"&&t===0||this.options.gestureOrientation==="horizontal"&&e===0;if(a||o)return;let l=n.composedPath();l=l.slice(0,l.indexOf(this.rootElement));const c=this.options.prevent,u=Math.abs(e)>=Math.abs(t)?"horizontal":"vertical";if(l.find(x=>x instanceof HTMLElement&&(typeof c=="function"&&c?.(x)||x.hasAttribute?.("data-lenis-prevent")||u==="vertical"&&x.hasAttribute?.("data-lenis-prevent-vertical")||u==="horizontal"&&x.hasAttribute?.("data-lenis-prevent-horizontal")||s&&x.hasAttribute?.("data-lenis-prevent-touch")||r&&x.hasAttribute?.("data-lenis-prevent-wheel")||this.options.allowNestedScroll&&this.hasNestedScroll(x,{deltaX:e,deltaY:t}))))return;if(this.isStopped||this.isLocked){n.cancelable&&n.preventDefault();return}if(!(this.options.syncTouch&&s||this.options.smoothWheel&&r)){this.isScrolling="native",this.animate.stop(),n.lenisStopPropagation=!0;return}let p=t;this.options.gestureOrientation==="both"?p=Math.abs(t)>Math.abs(e)?t:e:this.options.gestureOrientation==="horizontal"&&(p=e),(!this.options.overscroll||this.options.infinite||this.options.wrapper!==window&&this.limit>0&&(this.animatedScroll>0&&this.animatedScroll<this.limit||this.animatedScroll===0&&t>0||this.animatedScroll===this.limit&&t<0))&&(n.lenisStopPropagation=!0),n.cancelable&&n.preventDefault();const d=s&&this.options.syncTouch,g=s&&n.type==="touchend";g&&(p=Math.sign(p)*Math.abs(this.velocity)**this.options.touchInertiaExponent),this.scrollTo(this.targetScroll+p,{programmatic:!1,...d?{lerp:g?this.options.syncTouchLerp:1}:{lerp:this.options.lerp,duration:this.options.duration,easing:this.options.easing}})};resize(){this.dimensions.resize(),this.animatedScroll=this.targetScroll=this.actualScroll,this.emit()}emit(){this.emitter.emit("scroll",this)}onNativeScroll=()=>{if(this._resetVelocityTimeout!==null&&(clearTimeout(this._resetVelocityTimeout),this._resetVelocityTimeout=null),this._preventNextNativeScrollEvent){this._preventNextNativeScrollEvent=!1;return}if(this.isScrolling===!1||this.isScrolling==="native"){const i=this.animatedScroll;this.animatedScroll=this.targetScroll=this.actualScroll,this.lastVelocity=this.velocity,this.velocity=this.animatedScroll-i,this.direction=Math.sign(this.animatedScroll-i),this.isStopped||(this.isScrolling="native"),this.emit(),this.velocity!==0&&(this._resetVelocityTimeout=setTimeout(()=>{this.lastVelocity=this.velocity,this.velocity=0,this.isScrolling=!1,this.emit()},400))}};reset(){this.isLocked=!1,this.isScrolling=!1,this.animatedScroll=this.targetScroll=this.actualScroll,this.lastVelocity=this.velocity=0,this.animate.stop()}start(){if(this.isStopped){if(this.options.autoToggle){this.rootElement.style.removeProperty("overflow");return}this.internalStart()}}internalStart(){this.isStopped&&(this.reset(),this.isStopped=!1,this.emit())}stop(){if(!this.isStopped){if(this.options.autoToggle){this.rootElement.style.setProperty("overflow","clip");return}this.internalStop()}}internalStop(){this.isStopped||(this.reset(),this.isStopped=!0,this.emit())}raf=i=>{const e=i-(this.time||i);this.time=i,this.animate.advance(e*.001),this.options.autoRaf&&(this._rafId=requestAnimationFrame(this.raf))};scrollTo(i,{offset:e=0,immediate:t=!1,lock:n=!1,programmatic:s=!0,lerp:r=s?this.options.lerp:void 0,duration:a=s?this.options.duration:void 0,easing:o=s?this.options.easing:void 0,onStart:l,onComplete:c,force:u=!1,userData:p}={}){if(this.prefersReducedMotion&&(s?t=!0:(r=1,a=void 0,o=void 0)),(this.isStopped||this.isLocked)&&!u)return;let d=i,g=e;if(typeof d=="string"&&["top","left","start","#"].includes(d))d=0;else if(typeof d=="string"&&["bottom","right","end"].includes(d))d=this.limit;else{let x=null;if(typeof d=="string"?(x=d.startsWith("#")?document.getElementById(d.slice(1)):document.querySelector(d),x||d==="#top"&&(d=0)):d instanceof HTMLElement&&d?.nodeType&&(x=d),x){if(this.options.wrapper!==window){const M=this.rootElement.getBoundingClientRect();g-=this.isHorizontal?M.left:M.top}const b=x.getBoundingClientRect(),m=getComputedStyle(x),h=this.isHorizontal?Number.parseFloat(m.scrollMarginLeft):Number.parseFloat(m.scrollMarginTop),A=getComputedStyle(this.rootElement),P=this.isHorizontal?Number.parseFloat(A.scrollPaddingLeft):Number.parseFloat(A.scrollPaddingTop);d=(this.isHorizontal?b.left:b.top)+this.animatedScroll-(Number.isNaN(h)?0:h)-(Number.isNaN(P)?0:P)}}if(typeof d=="number"){if(d+=g,this.options.infinite){if(s){this.targetScroll=this.animatedScroll=this.scroll;const x=d-this.animatedScroll;x>this.limit/2?d-=this.limit:x<-this.limit/2&&(d+=this.limit)}}else d=bo(0,d,this.limit);if(d===this.targetScroll){l?.(this),c?.(this);return}if(this.userData=p??{},t){this.animatedScroll=this.targetScroll=d,this.setScroll(this.scroll),this.reset(),this.preventNextNativeScrollEvent(),this.emit(),c?.(this),this.userData={},requestAnimationFrame(()=>{this.dispatchScrollendEvent()});return}s||(this.targetScroll=d),typeof a=="number"&&typeof o!="function"?o=va:typeof o=="function"&&typeof a!="number"&&(a=1),this.animate.fromTo(this.animatedScroll,d,{duration:a,easing:o,lerp:r,onStart:()=>{n&&(this.isLocked=!0),this.isScrolling="smooth",l?.(this)},onUpdate:(x,b)=>{this.isScrolling="smooth",this.lastVelocity=this.velocity,this.velocity=x-this.animatedScroll,this.direction=Math.sign(this.velocity),this.animatedScroll=x,this.setScroll(this.scroll),s&&(this.targetScroll=x),b||this.emit(),b&&(this.reset(),this.emit(),c?.(this),this.userData={},requestAnimationFrame(()=>{this.dispatchScrollendEvent()}),this.preventNextNativeScrollEvent())}})}}preventNextNativeScrollEvent(){this._preventNextNativeScrollEvent=!0,requestAnimationFrame(()=>{this._preventNextNativeScrollEvent=!1})}hasNestedScroll(i,{deltaX:e,deltaY:t}){const n=Date.now();i._lenis||(i._lenis={});const s=i._lenis;let r,a,o,l,c,u,p,d,g,x;if(n-(s.time??0)>2e3){s.time=Date.now();const E=window.getComputedStyle(i);if(s.computedStyle=E,r=["auto","overlay","scroll"].includes(E.overflowX),a=["auto","overlay","scroll"].includes(E.overflowY),c=["auto"].includes(E.overscrollBehaviorX),u=["auto"].includes(E.overscrollBehaviorY),s.hasOverflowX=r,s.hasOverflowY=a,!(r||a))return!1;p=i.scrollWidth,d=i.scrollHeight,g=i.clientWidth,x=i.clientHeight,o=p>g,l=d>x,s.isScrollableX=o,s.isScrollableY=l,s.scrollWidth=p,s.scrollHeight=d,s.clientWidth=g,s.clientHeight=x,s.hasOverscrollBehaviorX=c,s.hasOverscrollBehaviorY=u}else o=s.isScrollableX,l=s.isScrollableY,r=s.hasOverflowX,a=s.hasOverflowY,p=s.scrollWidth,d=s.scrollHeight,g=s.clientWidth,x=s.clientHeight,c=s.hasOverscrollBehaviorX,u=s.hasOverscrollBehaviorY;if(!(r&&o||a&&l))return!1;const b=Math.abs(e)>=Math.abs(t)?"horizontal":"vertical";let m,h,A,P,M,T;if(b==="horizontal")m=Math.round(i.scrollLeft),h=p-g,A=e,P=r,M=o,T=c;else if(b==="vertical")m=Math.round(i.scrollTop),h=d-x,A=t,P=a,M=l,T=u;else return!1;return!T&&(m>=h||m<=0)?!0:(A>0?m<h:m>0)&&P&&M}get rootElement(){return this.options.wrapper===window?document.documentElement:this.options.wrapper}get limit(){return this.options.naiveDimensions?this.isHorizontal?this.rootElement.scrollWidth-this.rootElement.clientWidth:this.rootElement.scrollHeight-this.rootElement.clientHeight:this.dimensions.limit[this.isHorizontal?"x":"y"]}get isHorizontal(){return this.options.orientation==="horizontal"}get actualScroll(){const i=this.options.wrapper;return this.isHorizontal?i.scrollX??i.scrollLeft:i.scrollY??i.scrollTop}get scroll(){return this.options.infinite?kl(this.animatedScroll,this.limit):this.animatedScroll}get progress(){return this.limit===0?1:this.scroll/this.limit}get isScrolling(){return this._isScrolling}set isScrolling(i){this._isScrolling!==i&&(this._isScrolling=i,this.updateClassName())}get isStopped(){return this._isStopped}set isStopped(i){this._isStopped!==i&&(this._isStopped=i,this.updateClassName())}get isLocked(){return this._isLocked}set isLocked(i){this._isLocked!==i&&(this._isLocked=i,this.updateClassName())}get isSmooth(){return this.isScrolling==="smooth"}get prefersReducedMotion(){return this.options.respectReducedMotion&&this.reducedMotionMediaQuery.matches}get className(){let i="lenis";return this.options.autoToggle&&(i+=" lenis-autoToggle"),this.isStopped&&(i+=" lenis-stopped"),this.isLocked&&(i+=" lenis-locked"),this.isScrolling&&(i+=" lenis-scrolling"),this.isScrolling==="smooth"&&(i+=" lenis-smooth"),i}updateClassName(){this.cleanUpClassName(),this.className.split(" ").forEach(i=>{this.rootElement.classList.add(i)})}cleanUpClassName(){for(const i of Array.from(this.rootElement.classList))(i==="lenis"||i.startsWith("lenis-"))&&this.rootElement.classList.remove(i)}};const ct={brand:{years:new Date().getFullYear()-1938},navigation:{links:[{id:"hero",label:"Home"},{id:"legacy",label:"Heritage"},{id:"collections",label:"Collections"},{id:"wedding",label:"Wedding"},{id:"stores",label:"Stores"},{id:"shivamogga-event",label:"Shivamogga"},{id:"about",label:"About"},{id:"contact",label:"Contact"}],primaryAction:{label:"Register for Wedding Shopping",href:"/wedding/customer-registration"}},hero:{badge:"ESTABLISHED 1938 · FIVE GENERATIONS OF EXCELLENCE",title:"BSC Textiles",subtitle:"A legacy of textiles, fashion and timeless craftsmanship.",supportingText:"Karnataka’s foremost heritage house for pure silk sarees, bespoke menswear, bridal trousseaus, and curated luxury textiles. Five generations of authentic handloom excellence across Belagavi, Davanagere, and Shivamogga.",primaryCta:{label:"Register for Wedding Shopping",href:"/wedding/customer-registration"},secondaryCta:{label:"Discover Our Stores",targetId:"stores"}},floatingCards:[{id:1,tag:"BSC HERITAGE",title:"Five Generations",subtitle:"1938 → Present · 86+ Years",stat:"Est. 1938",description:"Karnataka’s timeless textile institution. Authentic handloom silks opened and draped on the counter, verified weaver by weaver.",highlight:"Silk Mark Certified Authentic Zari",image:"/images/floor.webp"},{id:2,tag:"FLAGSHIP SHOWROOMS",title:"Three Destinations",subtitle:"Davanagere · Belagavi · Shivamogga",stat:"3 Showrooms",description:"Over 60,000 sq. ft. of luxury shopping. Dedicated bridal suites, bespoke shirting desks, and home furnishing floors.",highlight:"Personalized Concierge Service",image:"/images/hero-bg.webp"},{id:3,tag:"WEDDING CONCIERGE",title:"Wedding Shopping",subtitle:"Personalized Bridal Experience",stat:"Private Suites",description:"A dedicated shopping hour for the whole family. Complete trousseau planning, burn-testing stations, and master suit markings.",highlight:"By Advance Appointment",image:"/images/wedding.webp"},{id:4,tag:"MASTER CURATION",title:"Curated Collections",subtitle:"Silks · Menswear · Home · Jewellery",stat:"12+ Departments",description:"From Kanchipuram Korvai silks to Giza cotton shirting, bespoke bandhgalas, and combed high-GSM bath linens.",highlight:"Handcrafted Heritage Pieces",image:"/images/women-real.webp"},{id:5,tag:"SPECIAL EVENT",title:"Shivamogga Showroom",subtitle:"Grand Opening & Bespoke Suite",stat:"New Flagship",description:"Experience Malnad’s premier fashion and wedding destination. Nehru Road, Durgigudi Main Road, Shivamogga.",highlight:"Exclusive Festive Inauguration",image:"/images/suit.webp"}],legacy:{kicker:"SINCE 1938 · FIVE GENERATIONS",title:"The Counter Tradition",subtitle:"Where cloth is felt, weighed, and draped before you decide.",bodyParagraphs:["In 1938, BSC opened its first textile counter in Karnataka with a single steadfast principle: every length of cloth must be unfolded before the family, its weave inspected under daylight, and its authenticity proven beyond doubt.","Eighty-six years and five generations later, that same reverence for craftsmanship continues across Belagavi, Davanagere, and Shivamogga. We still host on-counter burn tests for pure gold and silver zari, and our master tailors still chalk fittings on the body rather than relying on standard sizing charts."],timeline:[{year:"1938",title:"Founding in Khade Bazar",city:"Belagavi",desc:"First silk and textile counter established in Karnataka by the founding generation."},{year:"1978",title:"Central Karnataka Flagship",city:"Davanagere",desc:"Expanded with a grand showroom dedicated to wedding trousseaus and home furnishings."},{year:"1992",title:"Bespoke Atelier",city:"Bespoke Desk",desc:"Master cutters and suit desks introduced for custom menswear, sherwanis, and bandhgalas."},{year:"2024",title:"New Flagship Showroom",city:"Shivamogga",desc:"State-of-the-art multi-level luxury shopping destination inaugurated on Nehru Road."}],stats:[{value:"86+",label:"Years of Heritage",sub:"Unbroken legacy since 1938"},{value:"5",label:"Generations",sub:"Of textile expertise & trust"},{value:"100%",label:"Pure Handloom",sub:"Silk Mark certified authenticity"},{value:"50k+",label:"Weddings Draped",sub:"Generations of celebration"}]},collectionsOverview:{kicker:"CURATED FLOORS",title:"3D Collection Galleries",subtitle:"Step into curated departments designed for unhurried exploration and tactile luxury.",items:[{id:"sarees",code:"01",title:"Sarees",category:"Pure Silks & Bridal Handlooms",description:"Kanchipuram Korvai, Banarasi Katan, Dharmavaram, and Arani silks preserved in cedar-lined cases.",image:"/images/women-real.webp",tag:"Silk Mark Certified",details:["Kanchipuram Korvai Weaves","Banarasi Brocade & Zari","Arani Pure Silks","Bridal Muhurtham Sarees"]},{id:"womenswear",code:"02",title:"Women's Collection",category:"Contemporary & Festive Couture",description:"Handcrafted lehengas, bridal anarkalis, festive coordinates, and celebration wear.",image:"/images/coll-bridal-1200.webp",tag:"Festive Couture",details:["Bridal Lehengas","Embroidered Anarkalis","Festive Coordinates","Ready-to-Wear Silks"]},{id:"menswear",code:"03",title:"Men's Collection",category:"Tailored Luxury & Shirting",description:"Fine Egyptian Giza cottons, pure Irish linens, Italian wools, and festive kurta ensembles.",image:"/images/men.webp",tag:"Master Fit",details:["Giza Cotton Shirting","Pure Linen Ensembles","Festive Silk Kurtas","Formal & Casual Suiting"]},{id:"kids",code:"04",title:"Kids Collection",category:"Junior Ethnic & Celebrations",description:"Traditional silk pavadas, miniature dhotis, festive kurtas, and celebration ensembles for children.",image:"/images/coll-trousseau-1200.webp",tag:"Pure & Soft Silk",details:["Pure Silk Pattu Pavadas","Boys Dhoti & Kurta Sets","Festive Occasion Wear","Hypoallergenic Natural Dyes"]},{id:"brands",code:"05",title:"Brand Collection",category:"Curated Mill Labels",description:"Direct partnerships with India’s foremost textile mills and luxury fabric manufacturers.",image:"/images/brands.webp",tag:"Verified Mills",details:["Raymond Fine Fabrics","Linen Club Italy","Arvind Luxury Cottons","Grasim Fine Suitings"]},{id:"home",code:"06",title:"Home Furnishing",category:"Living & Bed Linen",description:"Egyptian cotton bed sets, jacquard curtains, rich upholstery, and heirloom household fabrics.",image:"/images/home.webp",tag:"Luxury Living",details:["600+ Thread Count Bed Linen","Custom Jacquard Curtains","Sofa Fabrics & Upholstery","Dining Linen & Accessories"]},{id:"jewellery",code:"07",title:"Jewellery",category:"Temple & Heirloom Ornaments",description:"Traditional temple jewelry, antique gold finishes, and bridal ornaments displayed tray by tray in private suites.",image:"/images/jewellery.webp",tag:"Private Viewing",details:["Temple Chokers & Haarams","Antique Bridal Sets","Jhumkas & Maang Tikkas","Private Consultation Room"]},{id:"wedding-coll",code:"08",title:"Wedding Collection",category:"Complete Trousseau Curation",description:"Sarees, shirting, blouse pieces, and wedding party cloth gathered in one booked consultation hour.",image:"/images/wedding.webp",tag:"Complete Trousseau",details:["Bride & Groom Coordination","Wedding Party Sets","Muhurtham & Reception Silks","Bespoke Family Packages"]},{id:"suits",code:"09",title:"Suits",category:"Bespoke Suit Desk",description:"Bandhgalas, tuxedos, and sherwanis measured and marked directly on your posture by master drapers.",image:"/images/suit.webp",tag:"Bespoke Fitting",details:["Hand-Chalked Body Fittings","Bespoke Sherwanis & Indo-Western","Royal Jodhpur Bandhgalas","Custom 3-Piece Tuxedos"]},{id:"dozolo",code:"10",title:"Dozolo",category:"Contemporary & Ready Fashion",description:"Modern silhouette wear, fusion Indo-Western coordinates, and ready-to-wear celebrations.",image:"/images/women.webp",tag:"Modern Heritage",details:["Contemporary Silhouettes","Fusion Indo-Western","Occasion Separates","Modern Craftsmanship"]},{id:"towels",code:"11",title:"Towels",category:"Ultra Plush 700 GSM Linen",description:"700 GSM combed zero-twist Turkish cotton towels, bath sheets, and luxury spa coordinates.",image:"/images/towels.webp",tag:"Ultra Soft 700 GSM",details:["Zero-Twist Bath Towels","Plush Hand Towels & Mats","Spa Bathrobes","Quick-Dry Aerocore Weave"]},{id:"other",code:"12",title:"Other Collections",category:"Accessories & Draping Crafts",description:"Handcrafted dupattas, pure silk stoles, cufflinks, angavastrams, and festive accessories.",image:"/images/coll-temple-1200.webp",tag:"Artisan Accents",details:["Pure Silk Stoles","Zari Border Angavastrams","Custom Cufflinks & Brooches","Handmade Potlis & Clutches"]}]},weddingExperience:{kicker:"THE BSC WEDDING CONCIERGE",title:"Curated Wedding Shopping for the Whole Family",subtitle:"A dedicated consultation hour. One stylist, zero rush, every family member taken care of under one roof.",features:[{title:"Private Draping Suites",desc:"Spacious air-conditioned salons with sofa seating for up to 15 family members, refreshments, and unhurried viewing."},{title:"Dedicated Wedding Stylist",desc:"One assigned expert stays with your family throughout the journey, coordinating colours and budgets seamlessly."},{title:"On-Counter Pure Zari Testing",desc:"Witness the traditional burn and rub test right at your table so your elders have complete peace of mind."},{title:"Head-to-Toe Coordination",desc:"Match bride’s silk saree borders with groom’s angavastram, sherwani stoles, and family celebration attire."}],cta:{label:"Register for Wedding Shopping",href:"/wedding/customer-registration"}},stores:[{id:"davanagere",city:"Davanagere Central",name:"Mandipet · PB Road",badge:"Home & Linen Floor",established:"Est. 1978",address:"Mandipet / PB Road, MCC B Block, Davanagere, Karnataka 577001",phone:"+91 8192 221938",email:"davanagere@bsctextiles.in",hours:"10:30 AM – 8:00 PM · Seven days",departments:["Home Furnishing","Luxury Towels & Linens","Pure Silk Sarees","Menswear Shirting"],image:"/images/home.webp",mapsQuery:"BSC Textiles Mandipet Davanagere"},{id:"belagavi",city:"Belagavi Flagship",name:"Khade Bazar · Tilakwadi",badge:"Heritage Showroom & Silk Floor",established:"Est. 1938",address:"Khade Bazar / Raviwar Peth, Tilakwadi, Belagavi, Karnataka 590001",phone:"+91 831 242 1938",email:"belagavi@bsctextiles.in",hours:"10:30 AM – 8:30 PM · Seven days",departments:["Royal Bridal Silks","Jewellery Suite","Bespoke Menswear","Bridal Draping Suites"],image:"/images/floor.webp",mapsQuery:"BSC Textiles Khade Bazar Belagavi",featured:!0},{id:"shivamogga",city:"Shivamogga Flagship",name:"Nehru Road · Durgigudi",badge:"Bespoke Suit Desk & Wedding Floor",established:"Est. 1992",address:"Nehru Road / Durgigudi Main Road, Shivamogga, Karnataka 577201",phone:"+91 8182 221938",email:"shivamogga@bsctextiles.in",hours:"11:00 AM – 8:00 PM · Tue – Sun",departments:["Bespoke Tailoring","Sherwanis & Bandhgalas","Bridal Silks","Festive Womenswear"],image:"/images/suit.webp",mapsQuery:"BSC Textiles Nehru Road Shivamogga"}],shivamoggaEvent:{kicker:"GRAND INAUGURATION & FESTIVE PREVIEW",title:"The Shivamogga Flagship Showroom",date:"Inaugural Celebration Season",venue:"Nehru Road / Durgigudi Main Road, Shivamogga, Karnataka",description:"We welcome you to experience Shivamogga’s most expansive textile and wedding fashion destination. Spread across multiple curated levels featuring private bridal suites, bespoke suit ateliers, and Karnataka’s finest handloom silks.",highlights:["Over 20,000 sq. ft. of exclusive shopping space","Exclusive Kanchipuram and Banarasi handloom vault","Resident master cutters for custom suits and sherwanis","Complimentary valet parking and family hospitality suites"],cta:{label:"Get Directions & Visit",mapsQuery:"BSC Textiles Nehru Road Shivamogga"}},about:{kicker:"OUR PROMISE",title:"The Weaver’s Knot. The Master’s Eye.",quote:"“We do not sell cloth from a catalogue. We place the bale in your hands, test the zari before your eyes, and measure the garment on your body.”",author:"BSC Textiles Custodians",points:[{title:"Direct Weaver Partnerships",desc:"Over 400 weaver families across Kanchipuram, Varanasi, Dharmavaram, and Gadwal receive fair artisan compensation."},{title:"Authenticity Guarantee",desc:"Every genuine silk saree carries the Silk Mark of India tag with a unique serial number verifiable on the national portal."},{title:"Generations of Trust",desc:"Families who bought their grandparents’ wedding sarees here in 1950 return today for their children and grandchildren."}]},contact:{kicker:"REACH OUT TO US",title:"We Look Forward to Welcoming You",subtitle:"Plan your visit, schedule a wedding consultation, or speak directly with our store managers.",cards:[{title:"Wedding Concierge",info:"Book a private suite for your family",actionLabel:"Register Online",href:"/wedding/customer-registration",icon:"calendar"},{title:"Guest Feedback",info:"Share your shopping experience with store directors",actionLabel:"Leave Feedback",href:"/feedback-public",icon:"message"},{title:"Careers at BSC",info:"Explore fashion consultant & store operations roles",actionLabel:"Apply Now",href:"/apply",icon:"briefcase"}]}};function Yl({activeSection:i="hero",onNavigate:e}){const[t,n]=at.useState(!1),[s,r]=at.useState(null);at.useEffect(()=>{r(vl.get())},[]);const a=(o,l)=>{if(l.preventDefault(),n(!1),e)e(o);else{const c=document.getElementById(o);c&&c.scrollIntoView({behavior:"smooth"})}};return S.jsxs("header",{className:"sticky top-0 z-40 w-full bg-[#FAF7F2]/80 backdrop-blur-md border-b border-[#E8DFC8]/60 transition-all duration-300",children:[S.jsxs("div",{className:"max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between",children:[S.jsxs("a",{href:"#hero",onClick:o=>a("hero",o),className:"flex items-center gap-2.5 sm:gap-3 group select-none",children:[S.jsx("img",{src:"/Main_logo.png",alt:"BSC Textiles",className:"h-9 sm:h-11 w-auto object-contain transition-transform duration-300 group-hover:scale-105"}),S.jsxs("div",{className:"flex flex-col",children:[S.jsx("span",{className:"font-serif tracking-widest text-xs sm:text-sm font-bold text-[#1C1510] uppercase",children:"BSC TEXTILES"}),S.jsx("span",{className:"text-[9px] tracking-wider text-[#7A695C] uppercase font-medium -mt-0.5",children:"ESTD 1938 · KARNATAKA"})]})]}),S.jsx("nav",{className:"hidden lg:flex items-center gap-6 xl:gap-8",children:ct.navigation.links.map(o=>{const l=i===o.id;return S.jsxs("a",{href:`#${o.id}`,onClick:c=>a(o.id,c),className:`text-xs uppercase tracking-wider font-semibold transition-all duration-200 py-1 relative ${l?"text-[#1C1510]":"text-[#6F5F53] hover:text-[#1C1510]"}`,children:[o.label,l&&S.jsx("span",{className:"absolute bottom-0 left-0 w-full h-[1.5px] bg-[#B76E79] rounded-full animate-fade-in"})]},o.id)})}),S.jsxs("div",{className:"flex items-center gap-2 sm:gap-3",children:[s?S.jsxs(Ft,{to:"/dashboard",className:"hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[#1C1510] bg-[#EFE8DD] hover:bg-[#E4D9C8] transition-colors",children:[S.jsx(Sl,{className:"w-3.5 h-3.5 text-[#B76E79]"}),S.jsx("span",{children:s.name?.split(" ")[0]||"Staff"})]}):S.jsxs(Ft,{to:"/login",className:"hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[#6F5F53] hover:text-[#1C1510] hover:bg-[#EFE8DD]/70 transition-colors",children:[S.jsx(Ml,{className:"w-3.5 h-3.5"}),S.jsx("span",{children:"Staff Login"})]}),S.jsxs(Ft,{to:ct.navigation.primaryAction.href,className:"inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-[#1C1510] hover:bg-[#32231A] text-[#FAF7F2] text-xs font-semibold tracking-wide shadow-md transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]",children:[S.jsx("span",{children:ct.navigation.primaryAction.label}),S.jsx(_o,{className:"w-3.5 h-3.5 text-[#E8C7A8]"})]}),S.jsx("button",{type:"button",onClick:()=>n(!t),className:"lg:hidden p-2 rounded-xl text-[#1C1510] hover:bg-[#EFE8DD] transition-colors focus:outline-none","aria-label":"Toggle Navigation Menu",children:t?S.jsx(bl,{className:"w-5 h-5"}):S.jsx(El,{className:"w-5 h-5"})})]})]}),t&&S.jsx("div",{className:"lg:hidden bg-[#FAF7F2]/95 backdrop-blur-xl border-b border-[#E8DFC8] px-6 py-6 shadow-xl animate-fade-in",children:S.jsxs("nav",{className:"flex flex-col gap-3",children:[ct.navigation.links.map(o=>S.jsx("a",{href:`#${o.id}`,onClick:l=>a(o.id,l),className:"text-sm font-semibold tracking-wider uppercase text-[#1C1510] py-2 border-b border-[#E8DFC8]/40 hover:text-[#B76E79] transition-colors",children:o.label},o.id)),S.jsxs("div",{className:"pt-3 flex flex-col gap-2.5",children:[S.jsx(Ft,{to:ct.navigation.primaryAction.href,onClick:()=>n(!1),className:"w-full text-center py-2.5 rounded-full bg-[#1C1510] text-[#FAF7F2] text-xs font-bold uppercase tracking-wider shadow-sm",children:ct.navigation.primaryAction.label}),S.jsx(Ft,{to:s?"/dashboard":"/login",onClick:()=>n(!1),className:"w-full text-center py-2 rounded-full border border-[#D5C6B5] text-[#1C1510] text-xs font-bold uppercase tracking-wider",children:s?"Go to Staff Dashboard":"Staff Login"})]})]})})]})}/**
 * @license
 * Copyright 2010-2026 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const Zr="186",jl=0,Sa=1,Kl=2,os=1,Zl=2,Mi=3,kn=0,Lt=1,pn=2,gn=0,Ei=1,ir=2,Ma=3,ba=4,$l=5,ri=100,Jl=101,Ql=102,ec=103,tc=104,nc=200,ic=201,sc=202,rc=203,yo=204,To=205,ac=206,oc=207,lc=208,cc=209,dc=210,hc=211,uc=212,fc=213,pc=214,sr=0,rr=1,ar=2,yi=3,or=4,lr=5,cr=6,dr=7,wo=0,mc=1,gc=2,sn=0,Ao=1,Co=2,Ro=3,Po=4,No=5,Lo=6,Do=7,Io=300,Hn=301,ci=302,ys=303,Ts=304,_s=306,hr=1e3,mn=1001,ur=1002,St=1003,xc=1004,Fi=1005,Tt=1006,ws=1007,Bn=1008,Ot=1009,Uo=1010,Fo=1011,Ti=1012,$r=1013,rn=1014,tn=1015,an=1016,Jr=1017,Qr=1018,wi=1020,Oo=35902,Bo=35899,zo=1021,ko=1022,qt=1023,vn=1026,zn=1027,Ho=1028,ea=1029,Gn=1030,ta=1031,na=1033,ls=33776,cs=33777,ds=33778,hs=33779,fr=35840,pr=35841,mr=35842,gr=35843,xr=36196,_r=37492,vr=37496,Sr=37488,Mr=37489,fs=37490,br=37491,Er=37808,yr=37809,Tr=37810,wr=37811,Ar=37812,Cr=37813,Rr=37814,Pr=37815,Nr=37816,Lr=37817,Dr=37818,Ir=37819,Ur=37820,Fr=37821,Or=36492,Br=36494,zr=36495,kr=36283,Hr=36284,ps=36285,Gr=36286,_c=3200,Vr=0,vc=1,Pn="",kt="srgb",ms="srgb-linear",gs="linear",$e="srgb",As=7680,Sc=519,Mc=512,bc=513,Ec=514,ia=515,yc=516,Tc=517,sa=518,wc=519,Ac=35044,Ea="300 es",nn=2e3,Ai=2001;function Cc(i){for(let e=i.length-1;e>=0;--e)if(i[e]>=65535)return!0;return!1}function xs(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function Rc(){const i=xs("canvas");return i.style.display="block",i}const ya={};function Ta(...i){const e="THREE."+i.shift()}function Go(i){const e=i[0];if(typeof e=="string"&&e.startsWith("TSL:")){const t=i[1];t&&t.isStackTrace?i[0]+=" "+t.getLocation():i[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return i}function Re(...i){i=Go(i);const e="THREE."+i.shift();{const t=i[0];t&&t.isStackTrace}}function qe(...i){i=Go(i);const e="THREE."+i.shift();{const t=i[0];t&&t.isStackTrace}}function oi(...i){const e=i.join(" ");e in ya||(ya[e]=!0,Re(...i))}function Pc(i,e,t){return new Promise(function(n,s){function r(){switch(i.clientWaitSync(e,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:s();break;case i.TIMEOUT_EXPIRED:setTimeout(r,t);break;default:n()}}setTimeout(r,t)})}const Nc={[sr]:rr,[ar]:cr,[or]:dr,[yi]:lr,[rr]:sr,[cr]:ar,[dr]:or,[lr]:yi};class Vn{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});const n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){const n=this._listeners;return n===void 0?!1:n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){const n=this._listeners;if(n===void 0)return;const s=n[e];if(s!==void 0){const r=s.indexOf(t);r!==-1&&s.splice(r,1)}}dispatchEvent(e){const t=this._listeners;if(t===void 0)return;const n=t[e.type];if(n!==void 0){e.target=this;const s=n.slice(0);for(let r=0,a=s.length;r<a;r++)s[r].call(this,e);e.target=null}}}const Et=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],Cs=Math.PI/180,Wr=180/Math.PI;function Pi(){const i=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Et[i&255]+Et[i>>8&255]+Et[i>>16&255]+Et[i>>24&255]+"-"+Et[e&255]+Et[e>>8&255]+"-"+Et[e>>16&15|64]+Et[e>>24&255]+"-"+Et[t&63|128]+Et[t>>8&255]+"-"+Et[t>>16&255]+Et[t>>24&255]+Et[n&255]+Et[n>>8&255]+Et[n>>16&255]+Et[n>>24&255]).toLowerCase()}function He(i,e,t){return Math.max(e,Math.min(t,i))}function Lc(i,e){return(i%e+e)%e}function Rs(i,e,t){return(1-t)*i+t*e}function pi(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:case Uint8ClampedArray:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function Nt(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:case Uint8ClampedArray:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}class Ve{static{Ve.prototype.isVector2=!0}constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("THREE.Vector2: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){const t=this.x,n=this.y,s=e.elements;return this.x=s[0]*t+s[3]*n+s[6],this.y=s[1]*t+s[4]*n+s[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=He(this.x,e.x,t.x),this.y=He(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=He(this.x,e,t),this.y=He(this.y,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(He(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos(He(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){const n=Math.cos(t),s=Math.sin(t),r=this.x-e.x,a=this.y-e.y;return this.x=r*n-a*s+e.x,this.y=r*s+a*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class hi{constructor(e=0,t=0,n=0,s=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=s}static slerpFlat(e,t,n,s,r,a,o){let l=n[s+0],c=n[s+1],u=n[s+2],p=n[s+3],d=r[a+0],g=r[a+1],x=r[a+2],b=r[a+3];if(p!==b||l!==d||c!==g||u!==x){let m=l*d+c*g+u*x+p*b;m<0&&(d=-d,g=-g,x=-x,b=-b,m=-m);let h=1-o;if(m<.9995){const A=Math.acos(m),P=Math.sin(A);h=Math.sin(h*A)/P,o=Math.sin(o*A)/P,l=l*h+d*o,c=c*h+g*o,u=u*h+x*o,p=p*h+b*o}else{l=l*h+d*o,c=c*h+g*o,u=u*h+x*o,p=p*h+b*o;const A=1/Math.sqrt(l*l+c*c+u*u+p*p);l*=A,c*=A,u*=A,p*=A}}e[t]=l,e[t+1]=c,e[t+2]=u,e[t+3]=p}static multiplyQuaternionsFlat(e,t,n,s,r,a){const o=n[s],l=n[s+1],c=n[s+2],u=n[s+3],p=r[a],d=r[a+1],g=r[a+2],x=r[a+3];return e[t]=o*x+u*p+l*g-c*d,e[t+1]=l*x+u*d+c*p-o*g,e[t+2]=c*x+u*g+o*d-l*p,e[t+3]=u*x-o*p-l*d-c*g,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,s){return this._x=e,this._y=t,this._z=n,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){const n=e._x,s=e._y,r=e._z,a=e._order,o=Math.cos,l=Math.sin,c=o(n/2),u=o(s/2),p=o(r/2),d=l(n/2),g=l(s/2),x=l(r/2);switch(a){case"XYZ":this._x=d*u*p+c*g*x,this._y=c*g*p-d*u*x,this._z=c*u*x+d*g*p,this._w=c*u*p-d*g*x;break;case"YXZ":this._x=d*u*p+c*g*x,this._y=c*g*p-d*u*x,this._z=c*u*x-d*g*p,this._w=c*u*p+d*g*x;break;case"ZXY":this._x=d*u*p-c*g*x,this._y=c*g*p+d*u*x,this._z=c*u*x+d*g*p,this._w=c*u*p-d*g*x;break;case"ZYX":this._x=d*u*p-c*g*x,this._y=c*g*p+d*u*x,this._z=c*u*x-d*g*p,this._w=c*u*p+d*g*x;break;case"YZX":this._x=d*u*p+c*g*x,this._y=c*g*p+d*u*x,this._z=c*u*x-d*g*p,this._w=c*u*p-d*g*x;break;case"XZY":this._x=d*u*p-c*g*x,this._y=c*g*p-d*u*x,this._z=c*u*x+d*g*p,this._w=c*u*p+d*g*x;break;default:Re("Quaternion: .setFromEuler() encountered an unknown order: "+a)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){const n=t/2,s=Math.sin(n);return this._x=e.x*s,this._y=e.y*s,this._z=e.z*s,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){const t=e.elements,n=t[0],s=t[4],r=t[8],a=t[1],o=t[5],l=t[9],c=t[2],u=t[6],p=t[10],d=n+o+p;if(d>0){const g=.5/Math.sqrt(d+1);this._w=.25/g,this._x=(u-l)*g,this._y=(r-c)*g,this._z=(a-s)*g}else if(n>o&&n>p){const g=2*Math.sqrt(1+n-o-p);this._w=(u-l)/g,this._x=.25*g,this._y=(s+a)/g,this._z=(r+c)/g}else if(o>p){const g=2*Math.sqrt(1+o-n-p);this._w=(r-c)/g,this._x=(s+a)/g,this._y=.25*g,this._z=(l+u)/g}else{const g=2*Math.sqrt(1+p-n-o);this._w=(a-s)/g,this._x=(r+c)/g,this._y=(l+u)/g,this._z=.25*g}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<1e-8?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(He(this.dot(e),-1,1)))}rotateTowards(e,t){const n=this.angleTo(e);if(n===0)return this;const s=Math.min(1,t/n);return this.slerp(e,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){const n=e._x,s=e._y,r=e._z,a=e._w,o=t._x,l=t._y,c=t._z,u=t._w;return this._x=n*u+a*o+s*c-r*l,this._y=s*u+a*l+r*o-n*c,this._z=r*u+a*c+n*l-s*o,this._w=a*u-n*o-s*l-r*c,this._onChangeCallback(),this}slerp(e,t){let n=e._x,s=e._y,r=e._z,a=e._w,o=this.dot(e);o<0&&(n=-n,s=-s,r=-r,a=-a,o=-o);let l=1-t;if(o<.9995){const c=Math.acos(o),u=Math.sin(c);l=Math.sin(l*c)/u,t=Math.sin(t*c)/u,this._x=this._x*l+n*t,this._y=this._y*l+s*t,this._z=this._z*l+r*t,this._w=this._w*l+a*t,this._onChangeCallback()}else this._x=this._x*l+n*t,this._y=this._y*l+s*t,this._z=this._z*l+r*t,this._w=this._w*l+a*t,this.normalize();return this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){const e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),s=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(s*Math.sin(e),s*Math.cos(e),r*Math.sin(t),r*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class G{static{G.prototype.isVector3=!0}constructor(e=0,t=0,n=0){this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("THREE.Vector3: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(wa.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(wa.setFromAxisAngle(e,t))}applyMatrix3(e){const t=this.x,n=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6]*s,this.y=r[1]*t+r[4]*n+r[7]*s,this.z=r[2]*t+r[5]*n+r[8]*s,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){const t=this.x,n=this.y,s=this.z,r=e.elements,a=1/(r[3]*t+r[7]*n+r[11]*s+r[15]);return this.x=(r[0]*t+r[4]*n+r[8]*s+r[12])*a,this.y=(r[1]*t+r[5]*n+r[9]*s+r[13])*a,this.z=(r[2]*t+r[6]*n+r[10]*s+r[14])*a,this}applyQuaternion(e){const t=this.x,n=this.y,s=this.z,r=e.x,a=e.y,o=e.z,l=e.w,c=2*(a*s-o*n),u=2*(o*t-r*s),p=2*(r*n-a*t);return this.x=t+l*c+a*p-o*u,this.y=n+l*u+o*c-r*p,this.z=s+l*p+r*u-a*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){const t=this.x,n=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[4]*n+r[8]*s,this.y=r[1]*t+r[5]*n+r[9]*s,this.z=r[2]*t+r[6]*n+r[10]*s,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=He(this.x,e.x,t.x),this.y=He(this.y,e.y,t.y),this.z=He(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=He(this.x,e,t),this.y=He(this.y,e,t),this.z=He(this.z,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(He(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){const n=e.x,s=e.y,r=e.z,a=t.x,o=t.y,l=t.z;return this.x=s*l-r*o,this.y=r*a-n*l,this.z=n*o-s*a,this}projectOnVector(e){const t=e.lengthSq();if(t===0)return this.set(0,0,0);const n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return Ps.copy(this).projectOnVector(e),this.sub(Ps)}reflect(e){return this.sub(Ps.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos(He(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y,s=this.z-e.z;return t*t+n*n+s*s}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){const s=Math.sin(t)*e;return this.x=s*Math.sin(n),this.y=Math.cos(t)*e,this.z=s*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){const t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),s=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=s,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const Ps=new G,wa=new hi;class Ne{static{Ne.prototype.isMatrix3=!0}constructor(e,t,n,s,r,a,o,l,c){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,s,r,a,o,l,c)}set(e,t,n,s,r,a,o,l,c){const u=this.elements;return u[0]=e,u[1]=s,u[2]=o,u[3]=t,u[4]=r,u[5]=l,u[6]=n,u[7]=a,u[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){const t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,s=t.elements,r=this.elements,a=n[0],o=n[3],l=n[6],c=n[1],u=n[4],p=n[7],d=n[2],g=n[5],x=n[8],b=s[0],m=s[3],h=s[6],A=s[1],P=s[4],M=s[7],T=s[2],E=s[5],C=s[8];return r[0]=a*b+o*A+l*T,r[3]=a*m+o*P+l*E,r[6]=a*h+o*M+l*C,r[1]=c*b+u*A+p*T,r[4]=c*m+u*P+p*E,r[7]=c*h+u*M+p*C,r[2]=d*b+g*A+x*T,r[5]=d*m+g*P+x*E,r[8]=d*h+g*M+x*C,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],u=e[8];return t*a*u-t*o*c-n*r*u+n*o*l+s*r*c-s*a*l}invert(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],u=e[8],p=u*a-o*c,d=o*l-u*r,g=c*r-a*l,x=t*p+n*d+s*g;if(x===0)return this.set(0,0,0,0,0,0,0,0,0);const b=1/x;return e[0]=p*b,e[1]=(s*c-u*n)*b,e[2]=(o*n-s*a)*b,e[3]=d*b,e[4]=(u*t-s*l)*b,e[5]=(s*r-o*t)*b,e[6]=g*b,e[7]=(n*l-c*t)*b,e[8]=(a*t-n*r)*b,this}transpose(){let e;const t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){const t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,s,r,a,o){const l=Math.cos(r),c=Math.sin(r);return this.set(n*l,n*c,-n*(l*a+c*o)+a+e,-s*c,s*l,-s*(-c*a+l*o)+o+t,0,0,1),this}scale(e,t){return oi("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(Ns.makeScale(e,t)),this}rotate(e){return oi("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(Ns.makeRotation(-e)),this}translate(e,t){return oi("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(Ns.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){const t=this.elements,n=e.elements;for(let s=0;s<9;s++)if(t[s]!==n[s])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}}const Ns=new Ne,Aa=new Ne().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Ca=new Ne().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function Dc(){const i={enabled:!0,workingColorSpace:ms,spaces:{},convert:function(s,r,a){return this.enabled===!1||r===a||!r||!a||(this.spaces[r].transfer===$e&&(s.r=xn(s.r),s.g=xn(s.g),s.b=xn(s.b)),this.spaces[r].primaries!==this.spaces[a].primaries&&(s.applyMatrix3(this.spaces[r].toXYZ),s.applyMatrix3(this.spaces[a].fromXYZ)),this.spaces[a].transfer===$e&&(s.r=li(s.r),s.g=li(s.g),s.b=li(s.b))),s},workingToColorSpace:function(s,r){return this.convert(s,this.workingColorSpace,r)},colorSpaceToWorking:function(s,r){return this.convert(s,r,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===Pn?gs:this.spaces[s].transfer},getToneMappingMode:function(s){return this.spaces[s].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(s,r=this.workingColorSpace){return s.fromArray(this.spaces[r].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,r,a){return s.copy(this.spaces[r].toXYZ).multiply(this.spaces[a].fromXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(s,r){return oi("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),i.workingToColorSpace(s,r)},toWorkingColorSpace:function(s,r){return oi("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),i.colorSpaceToWorking(s,r)}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],n=[.3127,.329];return i.define({[ms]:{primaries:e,whitePoint:n,transfer:gs,toXYZ:Aa,fromXYZ:Ca,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:kt},outputColorSpaceConfig:{drawingBufferColorSpace:kt}},[kt]:{primaries:e,whitePoint:n,transfer:$e,toXYZ:Aa,fromXYZ:Ca,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:kt}}}),i}const ke=Dc();function xn(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function li(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}let qn;class Ic{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{qn===void 0&&(qn=xs("canvas")),qn.width=e.width,qn.height=e.height;const s=qn.getContext("2d");e instanceof ImageData?s.putImageData(e,0,0):s.drawImage(e,0,0,e.width,e.height),n=qn}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){const t=xs("canvas");t.width=e.width,t.height=e.height;const n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);const s=n.getImageData(0,0,e.width,e.height),r=s.data;for(let a=0;a<r.length;a++)r[a]=xn(r[a]/255)*255;return n.putImageData(s,0,0),t}else if(e.data){const t=e.data.slice(0);for(let n=0;n<t.length;n++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[n]=Math.floor(xn(t[n]/255)*255):t[n]=xn(t[n]);return{data:t,width:e.width,height:e.height}}else return Re("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}}let Uc=0;class ra{constructor(e=null){this.isTextureSource=!0,Object.defineProperty(this,"id",{value:Uc++}),this.uuid=Pi(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){const t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<"u"&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];const n={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let a=0,o=s.length;a<o;a++)s[a].isDataTexture?r.push(Ls(s[a].image)):r.push(Ls(s[a]))}else r=Ls(s);n.url=r}return t||(e.images[this.uuid]=n),n}}function Ls(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?Ic.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(Re("Texture: Unable to serialize Texture."),{})}let Fc=0;const Ds=new G;class Ct extends Vn{constructor(e=Ct.DEFAULT_IMAGE,t=Ct.DEFAULT_MAPPING,n=mn,s=mn,r=Tt,a=Bn,o=qt,l=Ot,c=Ct.DEFAULT_ANISOTROPY,u=Pn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Fc++}),this.uuid=Pi(),this.name="",this.source=new ra(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=s,this.magFilter=r,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new Ve(0,0),this.repeat=new Ve(1,1),this.center=new Ve(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Ne,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=u,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(Ds).x}get height(){return this.source.getSize(Ds).y}get depth(){return this.source.getSize(Ds).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(const t in e){const n=e[t];if(n===void 0){Re(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}const s=this[t];if(s===void 0){Re(`Texture.setValues(): property '${t}' does not exist.`);continue}s&&n&&s.isVector2&&n.isVector2||s&&n&&s.isVector3&&n.isVector3||s&&n&&s.isMatrix3&&n.isMatrix3?s.copy(n):this[t]=n}}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];const n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==Io)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case hr:e.x=e.x-Math.floor(e.x);break;case mn:e.x=e.x<0?0:1;break;case ur:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case hr:e.y=e.y-Math.floor(e.y);break;case mn:e.y=e.y<0?0:1;break;case ur:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}}Ct.DEFAULT_IMAGE=null;Ct.DEFAULT_MAPPING=Io;Ct.DEFAULT_ANISOTROPY=1;class dt{static{dt.prototype.isVector4=!0}constructor(e=0,t=0,n=0,s=1){this.x=e,this.y=t,this.z=n,this.w=s}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,s){return this.x=e,this.y=t,this.z=n,this.w=s,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("THREE.Vector4: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){const t=this.x,n=this.y,s=this.z,r=this.w,a=e.elements;return this.x=a[0]*t+a[4]*n+a[8]*s+a[12]*r,this.y=a[1]*t+a[5]*n+a[9]*s+a[13]*r,this.z=a[2]*t+a[6]*n+a[10]*s+a[14]*r,this.w=a[3]*t+a[7]*n+a[11]*s+a[15]*r,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);const t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,s,r;const l=e.elements,c=l[0],u=l[4],p=l[8],d=l[1],g=l[5],x=l[9],b=l[2],m=l[6],h=l[10];if(Math.abs(u-d)<.01&&Math.abs(p-b)<.01&&Math.abs(x-m)<.01){if(Math.abs(u+d)<.1&&Math.abs(p+b)<.1&&Math.abs(x+m)<.1&&Math.abs(c+g+h-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;const P=(c+1)/2,M=(g+1)/2,T=(h+1)/2,E=(u+d)/4,C=(p+b)/4,v=(x+m)/4;return P>M&&P>T?P<.01?(n=0,s=.707106781,r=.707106781):(n=Math.sqrt(P),s=E/n,r=C/n):M>T?M<.01?(n=.707106781,s=0,r=.707106781):(s=Math.sqrt(M),n=E/s,r=v/s):T<.01?(n=.707106781,s=.707106781,r=0):(r=Math.sqrt(T),n=C/r,s=v/r),this.set(n,s,r,t),this}let A=Math.sqrt((m-x)*(m-x)+(p-b)*(p-b)+(d-u)*(d-u));return Math.abs(A)<.001&&(A=1),this.x=(m-x)/A,this.y=(p-b)/A,this.z=(d-u)/A,this.w=Math.acos((c+g+h-1)/2),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=He(this.x,e.x,t.x),this.y=He(this.y,e.y,t.y),this.z=He(this.z,e.z,t.z),this.w=He(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=He(this.x,e,t),this.y=He(this.y,e,t),this.z=He(this.z,e,t),this.w=He(this.w,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(He(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class Oc extends Vn{constructor(e=1,t=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Tt,depthBuffer:!0,stencilBuffer:!1,resolveColorBuffer:!0,resolveDepthBuffer:!0,resolveStencilBuffer:!0,storeMultisampledColorBuffer:!0,storeMultisampledDepthBuffer:!0,storeMultisampledStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new dt(0,0,e,t),this.scissorTest=!1,this.viewport=new dt(0,0,e,t),this.textures=[];const s={width:e,height:t,depth:n.depth},r=new Ct(s),a=n.count;for(let o=0;o<a;o++)this.textures[o]=r.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveColorBuffer=n.resolveColorBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.storeMultisampledColorBuffer=n.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=n.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=n.storeMultisampledStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview,this.useArrayDepthTexture=n.useArrayDepthTexture}_setTextureOptions(e={}){const t={minFilter:Tt,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&this._depthTexture.renderTarget===this&&(this._depthTexture.renderTarget=null),e!==null&&e.renderTarget===null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=e,this.textures[s].image.height=t,this.textures[s].image.depth=n,this.textures[s].isData3DTexture!==!0&&(this.textures[s].isArrayTexture=this.textures[s].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;const s=Object.assign({},e.textures[t].image);this.textures[t].source=new ra(s)}if(this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveColorBuffer=e.resolveColorBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,this.storeMultisampledColorBuffer=e.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=e.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=e.storeMultisampledStencilBuffer,e.depthTexture!==null)if(e.depthTexture.renderTarget===e){const t=e.depthTexture.clone();t.renderTarget=null,this.depthTexture=t}else this.depthTexture=e.depthTexture;return this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}}class Yt extends Oc{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}}class Vo extends Ct{constructor(e=null,t=1,n=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:s},this.magFilter=St,this.minFilter=St,this.wrapR=mn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}}class Bc extends Ct{constructor(e=null,t=1,n=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:s},this.magFilter=St,this.minFilter=St,this.wrapR=mn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}}class ot{static{ot.prototype.isMatrix4=!0}constructor(e,t,n,s,r,a,o,l,c,u,p,d,g,x,b,m){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,s,r,a,o,l,c,u,p,d,g,x,b,m)}set(e,t,n,s,r,a,o,l,c,u,p,d,g,x,b,m){const h=this.elements;return h[0]=e,h[4]=t,h[8]=n,h[12]=s,h[1]=r,h[5]=a,h[9]=o,h[13]=l,h[2]=c,h[6]=u,h[10]=p,h[14]=d,h[3]=g,h[7]=x,h[11]=b,h[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new ot().fromArray(this.elements)}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){const t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){const t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return this.determinantAffine()===0?(e.set(1,0,0),t.set(0,1,0),n.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();const t=this.elements,n=e.elements,s=1/Yn.setFromMatrixColumn(e,0).length(),r=1/Yn.setFromMatrixColumn(e,1).length(),a=1/Yn.setFromMatrixColumn(e,2).length();return t[0]=n[0]*s,t[1]=n[1]*s,t[2]=n[2]*s,t[3]=0,t[4]=n[4]*r,t[5]=n[5]*r,t[6]=n[6]*r,t[7]=0,t[8]=n[8]*a,t[9]=n[9]*a,t[10]=n[10]*a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){const t=this.elements,n=e.x,s=e.y,r=e.z,a=Math.cos(n),o=Math.sin(n),l=Math.cos(s),c=Math.sin(s),u=Math.cos(r),p=Math.sin(r);if(e.order==="XYZ"){const d=a*u,g=a*p,x=o*u,b=o*p;t[0]=l*u,t[4]=-l*p,t[8]=c,t[1]=g+x*c,t[5]=d-b*c,t[9]=-o*l,t[2]=b-d*c,t[6]=x+g*c,t[10]=a*l}else if(e.order==="YXZ"){const d=l*u,g=l*p,x=c*u,b=c*p;t[0]=d+b*o,t[4]=x*o-g,t[8]=a*c,t[1]=a*p,t[5]=a*u,t[9]=-o,t[2]=g*o-x,t[6]=b+d*o,t[10]=a*l}else if(e.order==="ZXY"){const d=l*u,g=l*p,x=c*u,b=c*p;t[0]=d-b*o,t[4]=-a*p,t[8]=x+g*o,t[1]=g+x*o,t[5]=a*u,t[9]=b-d*o,t[2]=-a*c,t[6]=o,t[10]=a*l}else if(e.order==="ZYX"){const d=a*u,g=a*p,x=o*u,b=o*p;t[0]=l*u,t[4]=x*c-g,t[8]=d*c+b,t[1]=l*p,t[5]=b*c+d,t[9]=g*c-x,t[2]=-c,t[6]=o*l,t[10]=a*l}else if(e.order==="YZX"){const d=a*l,g=a*c,x=o*l,b=o*c;t[0]=l*u,t[4]=b-d*p,t[8]=x*p+g,t[1]=p,t[5]=a*u,t[9]=-o*u,t[2]=-c*u,t[6]=g*p+x,t[10]=d-b*p}else if(e.order==="XZY"){const d=a*l,g=a*c,x=o*l,b=o*c;t[0]=l*u,t[4]=-p,t[8]=c*u,t[1]=d*p+b,t[5]=a*u,t[9]=g*p-x,t[2]=x*p-g,t[6]=o*u,t[10]=b*p+d}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(zc,e,kc)}lookAt(e,t,n){const s=this.elements;return Dt.subVectors(e,t),Dt.lengthSq()===0&&(Dt.z=1),Dt.normalize(),yn.crossVectors(n,Dt),yn.lengthSq()===0&&(Math.abs(n.z)===1?Dt.x+=1e-4:Dt.z+=1e-4,Dt.normalize(),yn.crossVectors(n,Dt)),yn.normalize(),Oi.crossVectors(Dt,yn),s[0]=yn.x,s[4]=Oi.x,s[8]=Dt.x,s[1]=yn.y,s[5]=Oi.y,s[9]=Dt.y,s[2]=yn.z,s[6]=Oi.z,s[10]=Dt.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,s=t.elements,r=this.elements,a=n[0],o=n[4],l=n[8],c=n[12],u=n[1],p=n[5],d=n[9],g=n[13],x=n[2],b=n[6],m=n[10],h=n[14],A=n[3],P=n[7],M=n[11],T=n[15],E=s[0],C=s[4],v=s[8],w=s[12],D=s[1],U=s[5],k=s[9],W=s[13],I=s[2],O=s[6],j=s[10],X=s[14],ne=s[3],q=s[7],Q=s[11],te=s[15];return r[0]=a*E+o*D+l*I+c*ne,r[4]=a*C+o*U+l*O+c*q,r[8]=a*v+o*k+l*j+c*Q,r[12]=a*w+o*W+l*X+c*te,r[1]=u*E+p*D+d*I+g*ne,r[5]=u*C+p*U+d*O+g*q,r[9]=u*v+p*k+d*j+g*Q,r[13]=u*w+p*W+d*X+g*te,r[2]=x*E+b*D+m*I+h*ne,r[6]=x*C+b*U+m*O+h*q,r[10]=x*v+b*k+m*j+h*Q,r[14]=x*w+b*W+m*X+h*te,r[3]=A*E+P*D+M*I+T*ne,r[7]=A*C+P*U+M*O+T*q,r[11]=A*v+P*k+M*j+T*Q,r[15]=A*w+P*W+M*X+T*te,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[4],s=e[8],r=e[12],a=e[1],o=e[5],l=e[9],c=e[13],u=e[2],p=e[6],d=e[10],g=e[14],x=e[3],b=e[7],m=e[11],h=e[15],A=l*g-c*d,P=o*g-c*p,M=o*d-l*p,T=a*g-c*u,E=a*d-l*u,C=a*p-o*u;return t*(b*A-m*P+h*M)-n*(x*A-m*T+h*E)+s*(x*P-b*T+h*C)-r*(x*M-b*E+m*C)}determinantAffine(){const e=this.elements,t=e[0],n=e[4],s=e[8],r=e[1],a=e[5],o=e[9],l=e[2],c=e[6],u=e[10];return t*(a*u-o*c)-n*(r*u-o*l)+s*(r*c-a*l)}transpose(){const e=this.elements;let t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){const s=this.elements;return e.isVector3?(s[12]=e.x,s[13]=e.y,s[14]=e.z):(s[12]=e,s[13]=t,s[14]=n),this}invert(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],u=e[8],p=e[9],d=e[10],g=e[11],x=e[12],b=e[13],m=e[14],h=e[15],A=t*o-n*a,P=t*l-s*a,M=t*c-r*a,T=n*l-s*o,E=n*c-r*o,C=s*c-r*l,v=u*b-p*x,w=u*m-d*x,D=u*h-g*x,U=p*m-d*b,k=p*h-g*b,W=d*h-g*m,I=A*W-P*k+M*U+T*D-E*w+C*v;if(I===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const O=1/I;return e[0]=(o*W-l*k+c*U)*O,e[1]=(s*k-n*W-r*U)*O,e[2]=(b*C-m*E+h*T)*O,e[3]=(d*E-p*C-g*T)*O,e[4]=(l*D-a*W-c*w)*O,e[5]=(t*W-s*D+r*w)*O,e[6]=(m*M-x*C-h*P)*O,e[7]=(u*C-d*M+g*P)*O,e[8]=(a*k-o*D+c*v)*O,e[9]=(n*D-t*k-r*v)*O,e[10]=(x*E-b*M+h*A)*O,e[11]=(p*M-u*E-g*A)*O,e[12]=(o*w-a*U-l*v)*O,e[13]=(t*U-n*w+s*v)*O,e[14]=(b*P-x*T-m*A)*O,e[15]=(u*T-p*P+d*A)*O,this}scale(e){const t=this.elements,n=e.x,s=e.y,r=e.z;return t[0]*=n,t[4]*=s,t[8]*=r,t[1]*=n,t[5]*=s,t[9]*=r,t[2]*=n,t[6]*=s,t[10]*=r,t[3]*=n,t[7]*=s,t[11]*=r,this}getMaxScaleOnAxis(){const e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],s=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,s))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){const t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){const n=Math.cos(t),s=Math.sin(t),r=1-n,a=e.x,o=e.y,l=e.z,c=r*a,u=r*o;return this.set(c*a+n,c*o-s*l,c*l+s*o,0,c*o+s*l,u*o+n,u*l-s*a,0,c*l-s*o,u*l+s*a,r*l*l+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,s,r,a){return this.set(1,n,r,0,e,1,a,0,t,s,1,0,0,0,0,1),this}compose(e,t,n){const s=this.elements,r=t._x,a=t._y,o=t._z,l=t._w,c=r+r,u=a+a,p=o+o,d=r*c,g=r*u,x=r*p,b=a*u,m=a*p,h=o*p,A=l*c,P=l*u,M=l*p,T=n.x,E=n.y,C=n.z;return s[0]=(1-(b+h))*T,s[1]=(g+M)*T,s[2]=(x-P)*T,s[3]=0,s[4]=(g-M)*E,s[5]=(1-(d+h))*E,s[6]=(m+A)*E,s[7]=0,s[8]=(x+P)*C,s[9]=(m-A)*C,s[10]=(1-(d+b))*C,s[11]=0,s[12]=e.x,s[13]=e.y,s[14]=e.z,s[15]=1,this}decompose(e,t,n){const s=this.elements;e.x=s[12],e.y=s[13],e.z=s[14];const r=this.determinantAffine();if(r===0)return n.set(1,1,1),t.identity(),this;let a=Yn.set(s[0],s[1],s[2]).length();const o=Yn.set(s[4],s[5],s[6]).length(),l=Yn.set(s[8],s[9],s[10]).length();r<0&&(a=-a),Gt.copy(this);const c=1/a,u=1/o,p=1/l;return Gt.elements[0]*=c,Gt.elements[1]*=c,Gt.elements[2]*=c,Gt.elements[4]*=u,Gt.elements[5]*=u,Gt.elements[6]*=u,Gt.elements[8]*=p,Gt.elements[9]*=p,Gt.elements[10]*=p,t.setFromRotationMatrix(Gt),n.x=a,n.y=o,n.z=l,this}makePerspective(e,t,n,s,r,a,o=nn,l=!1){const c=this.elements,u=2*r/(t-e),p=2*r/(n-s),d=(t+e)/(t-e),g=(n+s)/(n-s);let x,b;if(l)x=r/(a-r),b=a*r/(a-r);else if(o===nn)x=-(a+r)/(a-r),b=-2*a*r/(a-r);else if(o===Ai)x=-a/(a-r),b=-a*r/(a-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return c[0]=u,c[4]=0,c[8]=d,c[12]=0,c[1]=0,c[5]=p,c[9]=g,c[13]=0,c[2]=0,c[6]=0,c[10]=x,c[14]=b,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,n,s,r,a,o=nn,l=!1){const c=this.elements,u=2/(t-e),p=2/(n-s),d=-(t+e)/(t-e),g=-(n+s)/(n-s);let x,b;if(l)x=1/(a-r),b=a/(a-r);else if(o===nn)x=-2/(a-r),b=-(a+r)/(a-r);else if(o===Ai)x=-1/(a-r),b=-r/(a-r);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return c[0]=u,c[4]=0,c[8]=0,c[12]=d,c[1]=0,c[5]=p,c[9]=0,c[13]=g,c[2]=0,c[6]=0,c[10]=x,c[14]=b,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){const t=this.elements,n=e.elements;for(let s=0;s<16;s++)if(t[s]!==n[s])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}}const Yn=new G,Gt=new ot,zc=new G(0,0,0),kc=new G(1,1,1),yn=new G,Oi=new G,Dt=new G,Ra=new ot,Pa=new hi;class Nn{constructor(e=0,t=0,n=0,s=Nn.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=s}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,s=this._order){return this._x=e,this._y=t,this._z=n,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){const s=e.elements,r=s[0],a=s[4],o=s[8],l=s[1],c=s[5],u=s[9],p=s[2],d=s[6],g=s[10];switch(t){case"XYZ":this._y=Math.asin(He(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-u,g),this._z=Math.atan2(-a,r)):(this._x=Math.atan2(d,c),this._z=0);break;case"YXZ":this._x=Math.asin(-He(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(o,g),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-p,r),this._z=0);break;case"ZXY":this._x=Math.asin(He(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-p,g),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-He(p,-1,1)),Math.abs(p)<.9999999?(this._x=Math.atan2(d,g),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(He(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-u,c),this._y=Math.atan2(-p,r)):(this._x=0,this._y=Math.atan2(o,g));break;case"XZY":this._z=Math.asin(-He(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-u,g),this._y=0);break;default:Re("Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return Ra.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Ra,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return Pa.setFromEuler(this),this.setFromQuaternion(Pa,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}Nn.DEFAULT_ORDER="XYZ";class Wo{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}}let Hc=0;const Na=new G,jn=new hi,cn=new ot,Bi=new G,mi=new G,Gc=new G,Vc=new hi,La=new G(1,0,0),Da=new G(0,1,0),Ia=new G(0,0,1),Ua={type:"added"},Wc={type:"removed"},Kn={type:"childadded",child:null},Is={type:"childremoved",child:null};class Rt extends Vn{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Hc++}),this.uuid=Pi(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=Rt.DEFAULT_UP.clone();const e=new G,t=new Nn,n=new hi,s=new G(1,1,1);function r(){n.setFromEuler(t,!1)}function a(){t.setFromQuaternion(n,void 0,!1)}t._onChange(r),n._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new ot},normalMatrix:{value:new Ne}}),this.matrix=new ot,this.matrixWorld=new ot,this.matrixAutoUpdate=Rt.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=Rt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Wo,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return jn.setFromAxisAngle(e,t),this.quaternion.multiply(jn),this}rotateOnWorldAxis(e,t){return jn.setFromAxisAngle(e,t),this.quaternion.premultiply(jn),this}rotateX(e){return this.rotateOnAxis(La,e)}rotateY(e){return this.rotateOnAxis(Da,e)}rotateZ(e){return this.rotateOnAxis(Ia,e)}translateOnAxis(e,t){return Na.copy(e).applyQuaternion(this.quaternion),this.position.add(Na.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(La,e)}translateY(e){return this.translateOnAxis(Da,e)}translateZ(e){return this.translateOnAxis(Ia,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(cn.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?Bi.copy(e):Bi.set(e,t,n);const s=this.parent;this.updateWorldMatrix(!0,!1),mi.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?cn.lookAt(mi,Bi,this.up):cn.lookAt(Bi,mi,this.up),this.quaternion.setFromRotationMatrix(cn),s&&(cn.extractRotation(s.matrixWorld),jn.setFromRotationMatrix(cn),this.quaternion.premultiply(jn.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(qe("Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(Ua),Kn.child=e,this.dispatchEvent(Kn),Kn.child=null):qe("Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}const t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(Wc),Is.child=e,this.dispatchEvent(Is),Is.child=null),this}removeFromParent(){const e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),cn.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),cn.multiply(e.parent.matrixWorld)),e.applyMatrix4(cn),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(Ua),Kn.child=e,this.dispatchEvent(Kn),Kn.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,s=this.children.length;n<s;n++){const a=this.children[n].getObjectByProperty(e,t);if(a!==void 0)return a}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);const s=this.children;for(let r=0,a=s.length;r<a;r++)s[r].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(mi,e,Gc),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(mi,Vc,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);const t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}intersectsFrustum(){}traverse(e){e(this);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].traverseVisible(e)}traverseAncestors(e){const t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);const e=this.pivot;if(e!==null){const t=e.x,n=e.y,s=e.z,r=this.matrix.elements;r[12]+=t-r[0]*t-r[4]*n-r[8]*s,r[13]+=n-r[1]*t-r[5]*n-r[9]*s,r[14]+=s-r[2]*t-r[6]*n-r[10]*s}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t,n=!1){const s=this.parent;if(e===!0&&s!==null&&s.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||n)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,n=!0),t===!0){const r=this.children;for(let a=0,o=r.length;a<o;a++)r[a].updateWorldMatrix(!1,!0,n)}}toJSON(e){const t=e===void 0||typeof e=="string",n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});const s={};s.uuid=this.uuid,s.type=this.type,s.name=this.name,s.castShadow=this.castShadow,s.receiveShadow=this.receiveShadow,s.visible=this.visible,s.frustumCulled=this.frustumCulled,s.renderOrder=this.renderOrder,s.static=this.static,s.matrixAutoUpdate=this.matrixAutoUpdate,Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.pivot!==null&&(s.pivot=this.pivot.toArray()),this.morphTargetDictionary!==void 0&&(s.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(s.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),s.instanceInfo=this._instanceInfo.map(o=>({...o})),s.availableInstanceIds=this._availableInstanceIds.slice(),s.availableGeometryIds=this._availableGeometryIds.slice(),s.nextIndexStart=this._nextIndexStart,s.nextVertexStart=this._nextVertexStart,s.geometryCount=this._geometryCount,s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.matricesTexture=this._matricesTexture.toJSON(e),s.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(s.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(s.boundingBox=this.boundingBox.toJSON()));function r(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(e.geometries,this.geometry);const o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){const l=o.shapes;if(Array.isArray(l))for(let c=0,u=l.length;c<u;c++){const p=l[c];r(e.shapes,p)}else r(e.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(e.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(r(e.materials,this.material[l]));s.material=o}else s.material=r(e.materials,this.material);if(this.children.length>0){s.children=[];for(let o=0;o<this.children.length;o++)s.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){s.animations=[];for(let o=0;o<this.animations.length;o++){const l=this.animations[o];s.animations.push(r(e.animations,l))}}if(t){const o=a(e.geometries),l=a(e.materials),c=a(e.textures),u=a(e.images),p=a(e.shapes),d=a(e.skeletons),g=a(e.animations),x=a(e.nodes);o.length>0&&(n.geometries=o),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),u.length>0&&(n.images=u),p.length>0&&(n.shapes=p),d.length>0&&(n.skeletons=d),g.length>0&&(n.animations=g),x.length>0&&(n.nodes=x)}return n.object=s,n;function a(o){const l=[];for(const c in o){const u=o[c];delete u.metadata,l.push(u)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot!==null?e.pivot.clone():null,this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){const s=e.children[n];this.add(s.clone())}return this}dispose(){this.dispatchEvent({type:"dispose"})}}Rt.DEFAULT_UP=new G(0,1,0);Rt.DEFAULT_MATRIX_AUTO_UPDATE=!0;Rt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;class zi extends Rt{constructor(){super(),this.isGroup=!0,this.type="Group"}}const Xc={type:"move"};class Us{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new zi,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new zi,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new G,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new G),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new zi,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new G,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new G,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){const t=this._hand;if(t)for(const n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let s=null,r=null,a=null;const o=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){a=!0;for(const b of e.hand.values()){const m=t.getJointPose(b,n),h=this._getHandJoint(c,b);m!==null&&(h.matrix.fromArray(m.transform.matrix),h.matrix.decompose(h.position,h.rotation,h.scale),h.matrixWorldNeedsUpdate=!0,h.jointRadius=m.radius),h.visible=m!==null}const u=c.joints["index-finger-tip"],p=c.joints["thumb-tip"],d=u.position.distanceTo(p.position),g=.02,x=.005;c.inputState.pinching&&d>g+x?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&d<=g-x&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(r=t.getPose(e.gripSpace,n),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:e,target:this})));o!==null&&(s=t.getPose(e.targetRaySpace,n),s===null&&r!==null&&(s=r),s!==null&&(o.matrix.fromArray(s.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,s.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(s.linearVelocity)):o.hasLinearVelocity=!1,s.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(s.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(Xc)))}return o!==null&&(o.visible=s!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){const n=new zi;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}}const Xo={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Tn={h:0,s:0,l:0},ki={h:0,s:0,l:0};function Fs(i,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?i+(e-i)*6*t:t<1/2?e:t<2/3?i+(e-i)*6*(2/3-t):i}class Fe{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){const s=e;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=kt){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,ke.colorSpaceToWorking(this,t),this}setRGB(e,t,n,s=ke.workingColorSpace){return this.r=e,this.g=t,this.b=n,ke.colorSpaceToWorking(this,s),this}setHSL(e,t,n,s=ke.workingColorSpace){if(e=Lc(e,1),t=He(t,0,1),n=He(n,0,1),t===0)this.r=this.g=this.b=n;else{const r=n<=.5?n*(1+t):n+t-n*t,a=2*n-r;this.r=Fs(a,r,e+1/3),this.g=Fs(a,r,e),this.b=Fs(a,r,e-1/3)}return ke.colorSpaceToWorking(this,s),this}setStyle(e,t=kt){function n(r){r!==void 0&&parseFloat(r)<1&&Re("Color: Alpha component of "+e+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(e)){let r;const a=s[1],o=s[2];switch(a){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,t);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,t);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,t);break;default:Re("Color: Unknown color model "+e)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(e)){const r=s[1],a=r.length;if(a===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,t);if(a===6)return this.setHex(parseInt(r,16),t);Re("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=kt){const n=Xo[e.toLowerCase()];return n!==void 0?this.setHex(n,t):Re("Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=xn(e.r),this.g=xn(e.g),this.b=xn(e.b),this}copyLinearToSRGB(e){return this.r=li(e.r),this.g=li(e.g),this.b=li(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=kt){return ke.workingToColorSpace(yt.copy(this),e),Math.round(He(yt.r*255,0,255))*65536+Math.round(He(yt.g*255,0,255))*256+Math.round(He(yt.b*255,0,255))}getHexString(e=kt){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=ke.workingColorSpace){ke.workingToColorSpace(yt.copy(this),t);const n=yt.r,s=yt.g,r=yt.b,a=Math.max(n,s,r),o=Math.min(n,s,r);let l,c;const u=(o+a)/2;if(o===a)l=0,c=0;else{const p=a-o;switch(c=u<=.5?p/(a+o):p/(2-a-o),a){case n:l=(s-r)/p+(s<r?6:0);break;case s:l=(r-n)/p+2;break;case r:l=(n-s)/p+4;break}l/=6}return e.h=l,e.s=c,e.l=u,e}getRGB(e,t=ke.workingColorSpace){return ke.workingToColorSpace(yt.copy(this),t),e.r=yt.r,e.g=yt.g,e.b=yt.b,e}getStyle(e=kt){ke.workingToColorSpace(yt.copy(this),e);const t=yt.r,n=yt.g,s=yt.b;return e!==kt?`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(s*255)})`}offsetHSL(e,t,n){return this.getHSL(Tn),this.setHSL(Tn.h+e,Tn.s+t,Tn.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(Tn),e.getHSL(ki);const n=Rs(Tn.h,ki.h,t),s=Rs(Tn.s,ki.s,t),r=Rs(Tn.l,ki.l,t);return this.setHSL(n,s,r),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){const t=this.r,n=this.g,s=this.b,r=e.elements;return this.r=r[0]*t+r[3]*n+r[6]*s,this.g=r[1]*t+r[4]*n+r[7]*s,this.b=r[2]*t+r[5]*n+r[8]*s,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const yt=new Fe;Fe.NAMES=Xo;class qc extends Rt{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Nn,this.environmentIntensity=1,this.environmentRotation=new Nn,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){const t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),t.object.backgroundBlurriness=this.backgroundBlurriness,t.object.backgroundIntensity=this.backgroundIntensity,t.object.backgroundRotation=this.backgroundRotation.toArray(),t.object.environmentIntensity=this.environmentIntensity,t.object.environmentRotation=this.environmentRotation.toArray(),t}}const Vt=new G,dn=new G,Os=new G,hn=new G,Zn=new G,$n=new G,Fa=new G,Bs=new G,zs=new G,ks=new G,Hs=new dt,Gs=new dt,Vs=new dt;class Xt{constructor(e=new G,t=new G,n=new G){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,s){s.subVectors(n,t),Vt.subVectors(e,t),s.cross(Vt);const r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(e,t,n,s,r){Vt.subVectors(s,t),dn.subVectors(n,t),Os.subVectors(e,t);const a=Vt.dot(Vt),o=Vt.dot(dn),l=Vt.dot(Os),c=dn.dot(dn),u=dn.dot(Os),p=a*c-o*o;if(p===0)return r.set(0,0,0),null;const d=1/p,g=(c*l-o*u)*d,x=(a*u-o*l)*d;return r.set(1-g-x,x,g)}static containsPoint(e,t,n,s){return this.getBarycoord(e,t,n,s,hn)===null?!1:hn.x>=0&&hn.y>=0&&hn.x+hn.y<=1}static getInterpolation(e,t,n,s,r,a,o,l){return this.getBarycoord(e,t,n,s,hn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,hn.x),l.addScaledVector(a,hn.y),l.addScaledVector(o,hn.z),l)}static getInterpolatedAttribute(e,t,n,s,r,a){return Hs.setScalar(0),Gs.setScalar(0),Vs.setScalar(0),Hs.fromBufferAttribute(e,t),Gs.fromBufferAttribute(e,n),Vs.fromBufferAttribute(e,s),a.setScalar(0),a.addScaledVector(Hs,r.x),a.addScaledVector(Gs,r.y),a.addScaledVector(Vs,r.z),a}static isFrontFacing(e,t,n,s){return Vt.subVectors(n,t),dn.subVectors(e,t),Vt.cross(dn).dot(s)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,s){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[s]),this}setFromAttributeAndIndices(e,t,n,s){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,s),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return Vt.subVectors(this.c,this.b),dn.subVectors(this.a,this.b),Vt.cross(dn).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return Xt.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return Xt.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,n,s,r){return Xt.getInterpolation(e,this.a,this.b,this.c,t,n,s,r)}containsPoint(e){return Xt.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return Xt.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){const n=this.a,s=this.b,r=this.c;let a,o;Zn.subVectors(s,n),$n.subVectors(r,n),Bs.subVectors(e,n);const l=Zn.dot(Bs),c=$n.dot(Bs);if(l<=0&&c<=0)return t.copy(n);zs.subVectors(e,s);const u=Zn.dot(zs),p=$n.dot(zs);if(u>=0&&p<=u)return t.copy(s);const d=l*p-u*c;if(d<=0&&l>=0&&u<=0)return a=l/(l-u),t.copy(n).addScaledVector(Zn,a);ks.subVectors(e,r);const g=Zn.dot(ks),x=$n.dot(ks);if(x>=0&&g<=x)return t.copy(r);const b=g*c-l*x;if(b<=0&&c>=0&&x<=0)return o=c/(c-x),t.copy(n).addScaledVector($n,o);const m=u*x-g*p;if(m<=0&&p-u>=0&&g-x>=0)return Fa.subVectors(r,s),o=(p-u)/(p-u+(g-x)),t.copy(s).addScaledVector(Fa,o);const h=1/(m+b+d);return a=b*h,o=d*h,t.copy(n).addScaledVector(Zn,a).addScaledVector($n,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}}class Ni{constructor(e=new G(1/0,1/0,1/0),t=new G(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(Wt.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(Wt.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){const n=Wt.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);const n=e.geometry;if(n!==void 0){const r=n.getAttribute("position");if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let a=0,o=r.count;a<o;a++)e.isMesh===!0?e.getVertexPosition(a,Wt):Wt.fromBufferAttribute(r,a),Wt.applyMatrix4(e.matrixWorld),this.expandByPoint(Wt);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),Hi.copy(e.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),Hi.copy(n.boundingBox)),Hi.applyMatrix4(e.matrixWorld),this.union(Hi)}const s=e.children;for(let r=0,a=s.length;r<a;r++)this.expandByObject(s[r],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,Wt),Wt.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(gi),Gi.subVectors(this.max,gi),Jn.subVectors(e.a,gi),Qn.subVectors(e.b,gi),ei.subVectors(e.c,gi),wn.subVectors(Qn,Jn),An.subVectors(ei,Qn),Dn.subVectors(Jn,ei);let t=[0,-wn.z,wn.y,0,-An.z,An.y,0,-Dn.z,Dn.y,wn.z,0,-wn.x,An.z,0,-An.x,Dn.z,0,-Dn.x,-wn.y,wn.x,0,-An.y,An.x,0,-Dn.y,Dn.x,0];return!Ws(t,Jn,Qn,ei,Gi)||(t=[1,0,0,0,1,0,0,0,1],!Ws(t,Jn,Qn,ei,Gi))?!1:(Vi.crossVectors(wn,An),t=[Vi.x,Vi.y,Vi.z],Ws(t,Jn,Qn,ei,Gi))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,Wt).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(Wt).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(un[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),un[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),un[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),un[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),un[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),un[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),un[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),un[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(un),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}}const un=[new G,new G,new G,new G,new G,new G,new G,new G],Wt=new G,Hi=new Ni,Jn=new G,Qn=new G,ei=new G,wn=new G,An=new G,Dn=new G,gi=new G,Gi=new G,Vi=new G,In=new G;function Ws(i,e,t,n,s){for(let r=0,a=i.length-3;r<=a;r+=3){In.fromArray(i,r);const o=s.x*Math.abs(In.x)+s.y*Math.abs(In.y)+s.z*Math.abs(In.z),l=e.dot(In),c=t.dot(In),u=n.dot(In);if(Math.max(-Math.max(l,c,u),Math.min(l,c,u))>o)return!1}return!0}const pt=new G,Wi=new Ve;let Yc=0;class jt extends Vn{constructor(e,t,n=!1){if(super(),Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Yc++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=Ac,this.updateRanges=[],this.gpuType=tn,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[e+s]=t.array[n+s];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)Wi.fromBufferAttribute(this,t),Wi.applyMatrix3(e),this.setXY(t,Wi.x,Wi.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)pt.fromBufferAttribute(this,t),pt.applyMatrix3(e),this.setXYZ(t,pt.x,pt.y,pt.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)pt.fromBufferAttribute(this,t),pt.applyMatrix4(e),this.setXYZ(t,pt.x,pt.y,pt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)pt.fromBufferAttribute(this,t),pt.applyNormalMatrix(e),this.setXYZ(t,pt.x,pt.y,pt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)pt.fromBufferAttribute(this,t),pt.transformDirection(e),this.setXYZ(t,pt.x,pt.y,pt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=pi(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=Nt(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=pi(t,this.array)),t}setX(e,t){return this.normalized&&(t=Nt(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=pi(t,this.array)),t}setY(e,t){return this.normalized&&(t=Nt(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=pi(t,this.array)),t}setZ(e,t){return this.normalized&&(t=Nt(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=pi(t,this.array)),t}setW(e,t){return this.normalized&&(t=Nt(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=Nt(t,this.array),n=Nt(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,s){return e*=this.itemSize,this.normalized&&(t=Nt(t,this.array),n=Nt(n,this.array),s=Nt(s,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=s,this}setXYZW(e,t,n,s,r){return e*=this.itemSize,this.normalized&&(t=Nt(t,this.array),n=Nt(n,this.array),s=Nt(s,this.array),r=Nt(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=s,this.array[e+3]=r,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return e.name=this.name,e.usage=this.usage,e.gpuType=this.gpuType,e}dispose(){this.dispatchEvent({type:"dispose"})}}class qo extends jt{constructor(e,t,n){super(new Uint16Array(e),t,n)}}class Yo extends jt{constructor(e,t,n){super(new Uint32Array(e),t,n)}}class _n extends jt{constructor(e,t,n){super(new Float32Array(e),t,n)}}const jc=new Ni,xi=new G,Xs=new G;class vs{constructor(e=new G,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){const n=this.center;t!==void 0?n.copy(t):jc.setFromPoints(e).getCenter(n);let s=0;for(let r=0,a=e.length;r<a;r++)s=Math.max(s,n.distanceToSquared(e[r]));return this.radius=Math.sqrt(s),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){const t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){const n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;xi.subVectors(e,this.center);const t=xi.lengthSq();if(t>this.radius*this.radius){const n=Math.sqrt(t),s=(n-this.radius)*.5;this.center.addScaledVector(xi,s/n),this.radius+=s}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(Xs.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(xi.copy(e.center).add(Xs)),this.expandByPoint(xi.copy(e.center).sub(Xs))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}}let Kc=0;const zt=new ot,qs=new Rt,ti=new G,It=new Ni,_i=new Ni,vt=new G;class Kt extends Vn{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Kc++}),this.uuid=Pi(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(Cc(e)?Yo:qo)(e,1):this.index=e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){const t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);const n=this.attributes.normal;if(n!==void 0){const r=new Ne().getNormalMatrix(e);n.applyNormalMatrix(r),n.needsUpdate=!0}const s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(e),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(e){return zt.makeRotationFromQuaternion(e),this.applyMatrix4(zt),this}rotateX(e){return zt.makeRotationX(e),this.applyMatrix4(zt),this}rotateY(e){return zt.makeRotationY(e),this.applyMatrix4(zt),this}rotateZ(e){return zt.makeRotationZ(e),this.applyMatrix4(zt),this}translate(e,t,n){return zt.makeTranslation(e,t,n),this.applyMatrix4(zt),this}scale(e,t,n){return zt.makeScale(e,t,n),this.applyMatrix4(zt),this}lookAt(e){return qs.lookAt(e),qs.updateMatrix(),this.applyMatrix4(qs.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(ti).negate(),this.translate(ti.x,ti.y,ti.z),this}setFromPoints(e){const t=this.getAttribute("position");if(t===void 0){const n=[];for(let s=0,r=e.length;s<r;s++){const a=e[s];n.push(a.x,a.y,a.z||0)}this.setAttribute("position",new _n(n,3))}else{const n=Math.min(e.length,t.count);for(let s=0;s<n;s++){const r=e[s];t.setXYZ(s,r.x,r.y,r.z||0)}e.length>t.count&&Re("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Ni);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){qe("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new G(-1/0,-1/0,-1/0),new G(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,s=t.length;n<s;n++){const r=t[n];It.setFromBufferAttribute(r),this.morphTargetsRelative?(vt.addVectors(this.boundingBox.min,It.min),this.boundingBox.expandByPoint(vt),vt.addVectors(this.boundingBox.max,It.max),this.boundingBox.expandByPoint(vt)):(this.boundingBox.expandByPoint(It.min),this.boundingBox.expandByPoint(It.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&qe('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new vs);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){qe("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new G,1/0);return}if(e){const n=this.boundingSphere.center;if(It.setFromBufferAttribute(e),t)for(let r=0,a=t.length;r<a;r++){const o=t[r];_i.setFromBufferAttribute(o),this.morphTargetsRelative?(vt.addVectors(It.min,_i.min),It.expandByPoint(vt),vt.addVectors(It.max,_i.max),It.expandByPoint(vt)):(It.expandByPoint(_i.min),It.expandByPoint(_i.max))}It.getCenter(n);let s=0;for(let r=0,a=e.count;r<a;r++)vt.fromBufferAttribute(e,r),s=Math.max(s,n.distanceToSquared(vt));if(t)for(let r=0,a=t.length;r<a;r++){const o=t[r],l=this.morphTargetsRelative;for(let c=0,u=o.count;c<u;c++)vt.fromBufferAttribute(o,c),l&&(ti.fromBufferAttribute(e,c),vt.add(ti)),s=Math.max(s,n.distanceToSquared(vt))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&qe('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){qe("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const n=t.position,s=t.normal,r=t.uv;let a=this.getAttribute("tangent");(a===void 0||a.count!==n.count)&&(a=new jt(new Float32Array(4*n.count),4),this.setAttribute("tangent",a));const o=[],l=[];for(let v=0;v<n.count;v++)o[v]=new G,l[v]=new G;const c=new G,u=new G,p=new G,d=new Ve,g=new Ve,x=new Ve,b=new G,m=new G;function h(v,w,D){c.fromBufferAttribute(n,v),u.fromBufferAttribute(n,w),p.fromBufferAttribute(n,D),d.fromBufferAttribute(r,v),g.fromBufferAttribute(r,w),x.fromBufferAttribute(r,D),u.sub(c),p.sub(c),g.sub(d),x.sub(d);const U=1/(g.x*x.y-x.x*g.y);isFinite(U)&&(b.copy(u).multiplyScalar(x.y).addScaledVector(p,-g.y).multiplyScalar(U),m.copy(p).multiplyScalar(g.x).addScaledVector(u,-x.x).multiplyScalar(U),o[v].add(b),o[w].add(b),o[D].add(b),l[v].add(m),l[w].add(m),l[D].add(m))}let A=this.groups;A.length===0&&(A=[{start:0,count:e.count}]);for(let v=0,w=A.length;v<w;++v){const D=A[v],U=D.start,k=D.count;for(let W=U,I=U+k;W<I;W+=3)h(e.getX(W+0),e.getX(W+1),e.getX(W+2))}const P=new G,M=new G,T=new G,E=new G;function C(v){T.fromBufferAttribute(s,v),E.copy(T);const w=o[v];P.copy(w),P.sub(T.multiplyScalar(T.dot(w))).normalize(),M.crossVectors(E,w);const U=M.dot(l[v])<0?-1:1;a.setXYZW(v,P.x,P.y,P.z,U)}for(let v=0,w=A.length;v<w;++v){const D=A[v],U=D.start,k=D.count;for(let W=U,I=U+k;W<I;W+=3)C(e.getX(W+0)),C(e.getX(W+1)),C(e.getX(W+2))}this._transformed=!0}computeVertexNormals(){const e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0||n.count!==t.count)n=new jt(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let d=0,g=n.count;d<g;d++)n.setXYZ(d,0,0,0);const s=new G,r=new G,a=new G,o=new G,l=new G,c=new G,u=new G,p=new G;if(e)for(let d=0,g=e.count;d<g;d+=3){const x=e.getX(d+0),b=e.getX(d+1),m=e.getX(d+2);s.fromBufferAttribute(t,x),r.fromBufferAttribute(t,b),a.fromBufferAttribute(t,m),u.subVectors(a,r),p.subVectors(s,r),u.cross(p),o.fromBufferAttribute(n,x),l.fromBufferAttribute(n,b),c.fromBufferAttribute(n,m),o.add(u),l.add(u),c.add(u),n.setXYZ(x,o.x,o.y,o.z),n.setXYZ(b,l.x,l.y,l.z),n.setXYZ(m,c.x,c.y,c.z)}else for(let d=0,g=t.count;d<g;d+=3)s.fromBufferAttribute(t,d+0),r.fromBufferAttribute(t,d+1),a.fromBufferAttribute(t,d+2),u.subVectors(a,r),p.subVectors(s,r),u.cross(p),n.setXYZ(d+0,u.x,u.y,u.z),n.setXYZ(d+1,u.x,u.y,u.z),n.setXYZ(d+2,u.x,u.y,u.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){const e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)vt.fromBufferAttribute(e,t),vt.normalize(),e.setXYZ(t,vt.x,vt.y,vt.z)}toNonIndexed(){function e(o,l){const c=o.array,u=o.itemSize,p=o.normalized,d=new c.constructor(l.length*u);let g=0,x=0;for(let b=0,m=l.length;b<m;b++){o.isInterleavedBufferAttribute?g=l[b]*o.data.stride+o.offset:g=l[b]*u;for(let h=0;h<u;h++)d[x++]=c[g++]}return new jt(d,u,p)}if(this.index===null)return Re("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const t=new Kt,n=this.index.array,s=this.attributes;for(const o in s){const l=s[o],c=e(l,n);t.setAttribute(o,c)}const r=this.morphAttributes;for(const o in r){const l=[],c=r[o];for(let u=0,p=c.length;u<p;u++){const d=c[u],g=e(d,n);l.push(g)}t.morphAttributes[o]=l}t.morphTargetsRelative=this.morphTargetsRelative;const a=this.groups;for(let o=0,l=a.length;o<l;o++){const c=a[o];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){const e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,e.name=this.name,Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};const t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});const n=this.attributes;for(const l in n){const c=n[l];e.data.attributes[l]=c.toJSON(e.data)}const s={};let r=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],u=[];for(let p=0,d=c.length;p<d;p++){const g=c[p];u.push(g.toJSON(e.data))}u.length>0&&(s[l]=u,r=!0)}r&&(e.data.morphAttributes=s,e.data.morphTargetsRelative=this.morphTargetsRelative);const a=this.groups;a.length>0&&(e.data.groups=JSON.parse(JSON.stringify(a)));const o=this.boundingSphere;return o!==null&&(e.data.boundingSphere=o.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const t={};this.name=e.name;const n=e.index;n!==null&&this.setIndex(n.clone());const s=e.attributes;for(const c in s){const u=s[c];this.setAttribute(c,u.clone(t))}const r=e.morphAttributes;for(const c in r){const u=[],p=r[c];for(let d=0,g=p.length;d<g;d++)u.push(p[d].clone(t));this.morphAttributes[c]=u}this.morphTargetsRelative=e.morphTargetsRelative;const a=e.groups;for(let c=0,u=a.length;c<u;c++){const p=a[c];this.addGroup(p.start,p.count,p.materialIndex)}const o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());const l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}}const Ys=new G,Zc=new G,$c=new Ne;class Rn{constructor(e=new G(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,s){return this.normal.set(e,t,n),this.constant=s,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){const s=Ys.subVectors(n,t).cross(Zc.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(s,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){const e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,n=!0){const s=e.delta(Ys),r=this.normal.dot(s);if(r===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;const a=-(e.start.dot(this.normal)+this.constant)/r;return n===!0&&(a<0||a>1)?null:t.copy(e.start).addScaledVector(s,a)}intersectsLine(e){const t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){const n=t||$c.getNormalMatrix(e),s=this.coplanarPoint(Ys).applyMatrix4(e),r=this.normal.applyMatrix3(n).normalize();return this.constant=-s.dot(r),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}toJSON(){return{normal:this.normal.toArray(),constant:this.constant}}fromJSON(e){return this.normal.fromArray(e.normal),this.constant=e.constant,this}}let Jc=0;class ui extends Vn{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Jc++}),this.uuid=Pi(),this.name="",this.type="Material",this.blending=Ei,this.side=kn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=yo,this.blendDst=To,this.blendEquation=ri,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Fe(0,0,0),this.blendAlpha=0,this.depthFunc=yi,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Sc,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=As,this.stencilZFail=As,this.stencilZPass=As,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(const t in e){const n=e[t];if(n===void 0){Re(`Material: parameter '${t}' has value of undefined.`);continue}const s=this[t];if(s===void 0){Re(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(n):s&&s.isVector2&&n&&n.isVector2||s&&s.isEuler&&n&&n.isEuler||s&&s.isVector3&&n&&n.isVector3?s.copy(n):this[t]=n}}toJSON(e){const t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});const n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,n.blending=this.blending,n.side=this.side,n.shadowSide=this.shadowSide,n.vertexColors=this.vertexColors,n.opacity=this.opacity,n.transparent=this.transparent,n.blendSrc=this.blendSrc,n.blendDst=this.blendDst,n.blendEquation=this.blendEquation,n.blendSrcAlpha=this.blendSrcAlpha,n.blendDstAlpha=this.blendDstAlpha,n.blendEquationAlpha=this.blendEquationAlpha,n.blendColor=this.blendColor.getHex(),n.blendAlpha=this.blendAlpha,n.depthFunc=this.depthFunc,n.depthTest=this.depthTest,n.depthWrite=this.depthWrite,n.colorWrite=this.colorWrite,n.clipIntersection=this.clipIntersection,n.clipShadows=this.clipShadows,n.stencilWriteMask=this.stencilWriteMask,n.stencilFunc=this.stencilFunc,n.stencilRef=this.stencilRef,n.stencilFuncMask=this.stencilFuncMask,n.stencilFail=this.stencilFail,n.stencilZFail=this.stencilZFail,n.stencilZPass=this.stencilZPass,n.stencilWrite=this.stencilWrite,n.polygonOffset=this.polygonOffset,n.polygonOffsetFactor=this.polygonOffsetFactor,n.polygonOffsetUnits=this.polygonOffsetUnits,n.dithering=this.dithering,n.alphaTest=this.alphaTest,n.alphaHash=this.alphaHash,n.alphaToCoverage=this.alphaToCoverage,n.premultipliedAlpha=this.premultipliedAlpha,n.forceSinglePass=this.forceSinglePass,n.allowOverride=this.allowOverride,n.visible=this.visible,n.toneMapped=this.toneMapped,n.name=this.name,this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.retroreflectivity!==void 0&&(n.retroreflectivity=this.retroreflectivity),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),Array.isArray(this.clippingPlanes)&&this.clippingPlanes.length>0&&(n.clippingPlanes=this.clippingPlanes.map(r=>r.toJSON())),this.rotation!==void 0&&(n.rotation=this.rotation),this.depthPacking!==void 0&&(n.depthPacking=this.depthPacking),this.linewidth!==void 0&&(n.linewidth=this.linewidth),this.linecap!==void 0&&(n.linecap=this.linecap),this.linejoin!==void 0&&(n.linejoin=this.linejoin),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.wireframe!==void 0&&(n.wireframe=this.wireframe),this.wireframeLinewidth!==void 0&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!==void 0&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!==void 0&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading!==void 0&&(n.flatShading=this.flatShading),this.fog!==void 0&&(n.fog=this.fog),Object.keys(this.userData).length>0&&(n.userData=this.userData);function s(r){const a=[];for(const o in r){const l=r[o];delete l.metadata,a.push(l)}return a}if(t){const r=s(e.textures),a=s(e.images);r.length>0&&(n.textures=r),a.length>0&&(n.images=a)}return n}fromJSON(e,t){if(e.uuid!==void 0&&(this.uuid=e.uuid),e.name!==void 0&&(this.name=e.name),e.color!==void 0&&this.color!==void 0&&this.color.setHex(e.color),e.roughness!==void 0&&(this.roughness=e.roughness),e.metalness!==void 0&&(this.metalness=e.metalness),e.sheen!==void 0&&(this.sheen=e.sheen),e.sheenColor!==void 0&&(this.sheenColor=new Fe().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(this.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(e.emissive),e.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(e.specular),e.specularIntensity!==void 0&&(this.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(this.shininess=e.shininess),e.clearcoat!==void 0&&(this.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=e.clearcoatRoughness),e.dispersion!==void 0&&(this.dispersion=e.dispersion),e.retroreflectivity!==void 0&&(this.retroreflectivity=e.retroreflectivity),e.iridescence!==void 0&&(this.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(this.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=e.iridescenceThicknessRange),e.transmission!==void 0&&(this.transmission=e.transmission),e.thickness!==void 0&&(this.thickness=e.thickness),e.attenuationDistance!==void 0&&(this.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(this.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(this.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(this.fog=e.fog),e.flatShading!==void 0&&(this.flatShading=e.flatShading),e.blending!==void 0&&(this.blending=e.blending),e.combine!==void 0&&(this.combine=e.combine),e.side!==void 0&&(this.side=e.side),e.shadowSide!==void 0&&(this.shadowSide=e.shadowSide),e.opacity!==void 0&&(this.opacity=e.opacity),e.transparent!==void 0&&(this.transparent=e.transparent),e.alphaTest!==void 0&&(this.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(this.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(this.depthFunc=e.depthFunc),e.depthTest!==void 0&&(this.depthTest=e.depthTest),e.depthWrite!==void 0&&(this.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(this.colorWrite=e.colorWrite),e.clippingPlanes!==void 0&&(this.clippingPlanes=e.clippingPlanes.map(n=>new Rn().fromJSON(n))),e.clipIntersection!==void 0&&(this.clipIntersection=e.clipIntersection),e.clipShadows!==void 0&&(this.clipShadows=e.clipShadows),e.depthPacking!==void 0&&(this.depthPacking=e.depthPacking),e.blendSrc!==void 0&&(this.blendSrc=e.blendSrc),e.blendDst!==void 0&&(this.blendDst=e.blendDst),e.blendEquation!==void 0&&(this.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(this.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(this.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(this.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(this.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(this.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(this.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(this.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(this.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(this.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(this.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(this.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(this.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(this.rotation=e.rotation),e.linewidth!==void 0&&(this.linewidth=e.linewidth),e.linecap!==void 0&&(this.linecap=e.linecap),e.linejoin!==void 0&&(this.linejoin=e.linejoin),e.dashSize!==void 0&&(this.dashSize=e.dashSize),e.gapSize!==void 0&&(this.gapSize=e.gapSize),e.scale!==void 0&&(this.scale=e.scale),e.polygonOffset!==void 0&&(this.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(this.dithering=e.dithering),e.alphaToCoverage!==void 0&&(this.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(this.forceSinglePass=e.forceSinglePass),e.allowOverride!==void 0&&(this.allowOverride=e.allowOverride),e.visible!==void 0&&(this.visible=e.visible),e.toneMapped!==void 0&&(this.toneMapped=e.toneMapped),e.userData!==void 0&&(this.userData=e.userData),e.vertexColors!==void 0&&(typeof e.vertexColors=="number"?this.vertexColors=e.vertexColors>0:this.vertexColors=e.vertexColors),e.size!==void 0&&(this.size=e.size),e.sizeAttenuation!==void 0&&(this.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(this.map=t[e.map]||null),e.matcap!==void 0&&(this.matcap=t[e.matcap]||null),e.alphaMap!==void 0&&(this.alphaMap=t[e.alphaMap]||null),e.bumpMap!==void 0&&(this.bumpMap=t[e.bumpMap]||null),e.bumpScale!==void 0&&(this.bumpScale=e.bumpScale),e.normalMap!==void 0&&(this.normalMap=t[e.normalMap]||null),e.normalMapType!==void 0&&(this.normalMapType=e.normalMapType),e.normalScale!==void 0){let n=e.normalScale;Array.isArray(n)===!1&&(n=[n,n]),this.normalScale=new Ve().fromArray(n)}return e.displacementMap!==void 0&&(this.displacementMap=t[e.displacementMap]||null),e.displacementScale!==void 0&&(this.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(this.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(this.roughnessMap=t[e.roughnessMap]||null),e.metalnessMap!==void 0&&(this.metalnessMap=t[e.metalnessMap]||null),e.emissiveMap!==void 0&&(this.emissiveMap=t[e.emissiveMap]||null),e.emissiveIntensity!==void 0&&(this.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(this.specularMap=t[e.specularMap]||null),e.specularIntensityMap!==void 0&&(this.specularIntensityMap=t[e.specularIntensityMap]||null),e.specularColorMap!==void 0&&(this.specularColorMap=t[e.specularColorMap]||null),e.envMap!==void 0&&(this.envMap=t[e.envMap]||null),e.envMapRotation!==void 0&&this.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(this.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(this.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(this.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(this.lightMap=t[e.lightMap]||null),e.lightMapIntensity!==void 0&&(this.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(this.aoMap=t[e.aoMap]||null),e.aoMapIntensity!==void 0&&(this.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(this.gradientMap=t[e.gradientMap]||null),e.clearcoatMap!==void 0&&(this.clearcoatMap=t[e.clearcoatMap]||null),e.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null),e.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null),e.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new Ve().fromArray(e.clearcoatNormalScale)),e.iridescenceMap!==void 0&&(this.iridescenceMap=t[e.iridescenceMap]||null),e.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null),e.transmissionMap!==void 0&&(this.transmissionMap=t[e.transmissionMap]||null),e.thicknessMap!==void 0&&(this.thicknessMap=t[e.thicknessMap]||null),e.anisotropyMap!==void 0&&(this.anisotropyMap=t[e.anisotropyMap]||null),e.sheenColorMap!==void 0&&(this.sheenColorMap=t[e.sheenColorMap]||null),e.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;const t=e.clippingPlanes;let n=null;if(t!==null){const s=t.length;n=new Array(s);for(let r=0;r!==s;++r)n[r]=t[r].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}}const fn=new G,js=new G,Xi=new G,qi=new G;class jo{constructor(e=new G,t=new G(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,fn)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);const n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){const t=fn.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(fn.copy(this.origin).addScaledVector(this.direction,t),fn.distanceToSquared(e))}distanceSqToSegment(e,t,n,s){js.copy(e).add(t).multiplyScalar(.5),Xi.copy(t).sub(e).normalize(),qi.copy(this.origin).sub(js);const r=e.distanceTo(t)*.5,a=-this.direction.dot(Xi),o=qi.dot(this.direction),l=-qi.dot(Xi),c=qi.lengthSq(),u=Math.abs(1-a*a);let p,d,g,x;if(u>0)if(p=a*l-o,d=a*o-l,x=r*u,p>=0)if(d>=-x)if(d<=x){const b=1/u;p*=b,d*=b,g=p*(p+a*d+2*o)+d*(a*p+d+2*l)+c}else d=r,p=Math.max(0,-(a*d+o)),g=-p*p+d*(d+2*l)+c;else d=-r,p=Math.max(0,-(a*d+o)),g=-p*p+d*(d+2*l)+c;else d<=-x?(p=Math.max(0,-(-a*r+o)),d=p>0?-r:Math.min(Math.max(-r,-l),r),g=-p*p+d*(d+2*l)+c):d<=x?(p=0,d=Math.min(Math.max(-r,-l),r),g=d*(d+2*l)+c):(p=Math.max(0,-(a*r+o)),d=p>0?r:Math.min(Math.max(-r,-l),r),g=-p*p+d*(d+2*l)+c);else d=a>0?-r:r,p=Math.max(0,-(a*d+o)),g=-p*p+d*(d+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,p),s&&s.copy(js).addScaledVector(Xi,d),g}intersectSphere(e,t){if(e.radius<0)return null;fn.subVectors(e.center,this.origin);const n=fn.dot(this.direction),s=fn.dot(fn)-n*n,r=e.radius*e.radius;if(s>r)return null;const a=Math.sqrt(r-s),o=n-a,l=n+a;return l<0?null:o<0?this.at(l,t):this.at(o,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){const t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;const n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){const n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){const t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,s,r,a,o,l;const c=1/this.direction.x,u=1/this.direction.y,p=1/this.direction.z,d=this.origin;return c>=0?(n=(e.min.x-d.x)*c,s=(e.max.x-d.x)*c):(n=(e.max.x-d.x)*c,s=(e.min.x-d.x)*c),u>=0?(r=(e.min.y-d.y)*u,a=(e.max.y-d.y)*u):(r=(e.max.y-d.y)*u,a=(e.min.y-d.y)*u),n>a||r>s||((r>n||isNaN(n))&&(n=r),(a<s||isNaN(s))&&(s=a),p>=0?(o=(e.min.z-d.z)*p,l=(e.max.z-d.z)*p):(o=(e.max.z-d.z)*p,l=(e.min.z-d.z)*p),n>l||o>s)||((o>n||n!==n)&&(n=o),(l<s||s!==s)&&(s=l),s<0)?null:this.at(n>=0?n:s,t)}intersectsBox(e){return this.intersectBox(e,fn)!==null}intersectTriangle(e,t,n,s,r){const a=this.origin,o=this.direction,l=o.x,c=o.y,u=o.z,p=e.x-a.x,d=e.y-a.y,g=e.z-a.z,x=t.x-a.x,b=t.y-a.y,m=t.z-a.z,h=n.x-a.x,A=n.y-a.y,P=n.z-a.z,M=Math.abs(l),T=Math.abs(c),E=Math.abs(u);let C,v,w,D,U,k,W,I,O,j,X,ne;if(M>=T&&M>=E?(w=l,k=p,O=x,ne=h,l>=0?(C=c,v=u,D=d,U=g,W=b,I=m,j=A,X=P):(C=u,v=c,D=g,U=d,W=m,I=b,j=P,X=A)):T>=E?(w=c,k=d,O=b,ne=A,c>=0?(C=u,v=l,D=g,U=p,W=m,I=x,j=P,X=h):(C=l,v=u,D=p,U=g,W=x,I=m,j=h,X=P)):(w=u,k=g,O=m,ne=P,u>=0?(C=l,v=c,D=p,U=d,W=x,I=b,j=h,X=A):(C=c,v=l,D=d,U=p,W=b,I=x,j=A,X=h)),w===0)return null;const q=C/w,Q=v/w,te=1/w,Ae=D-q*k,Te=U-Q*k,et=W-q*O,Ge=I-Q*O,Ye=j-q*ne,K=X-Q*ne,ee=Ye*Ge-K*et,_e=Ae*K-Te*Ye,Pe=et*Te-Ge*Ae;if(s){if(ee<0||_e<0||Pe<0)return null}else if((ee<0||_e<0||Pe<0)&&(ee>0||_e>0||Pe>0))return null;const ge=ee+_e+Pe;if(ge===0)return null;const Ue=te*(ee*k+_e*O+Pe*ne);return(ge>0?Ue<0:Ue>0)?null:this.at(Ue/ge,r)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class Ko extends ui{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Fe(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Nn,this.combine=wo,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}}const Oa=new ot,Un=new jo,Yi=new vs,Ba=new G,ji=new G,Ki=new G,Zi=new G,Ks=new G,$i=new G,za=new G,Ji=new G;class on extends Rt{constructor(e=new Kt,t=new Ko){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const s=t[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){const o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(e,t){const n=this.geometry,s=n.attributes.position,r=n.morphAttributes.position,a=n.morphTargetsRelative;t.fromBufferAttribute(s,e);const o=this.morphTargetInfluences;if(r&&o){$i.set(0,0,0);for(let l=0,c=r.length;l<c;l++){const u=o[l],p=r[l];u!==0&&(Ks.fromBufferAttribute(p,e),a?$i.addScaledVector(Ks,u):$i.addScaledVector(Ks.sub(t),u))}t.add($i)}return t}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){const n=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),Yi.copy(n.boundingSphere),Yi.applyMatrix4(r),Un.copy(e.ray).recast(e.near),!(Yi.containsPoint(Un.origin)===!1&&(Un.intersectSphere(Yi,Ba)===null||Un.origin.distanceToSquared(Ba)>(e.far-e.near)**2))&&(Oa.copy(r).invert(),Un.copy(e.ray).applyMatrix4(Oa),!(n.boundingBox!==null&&Un.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(e,t,Un)))}_computeIntersections(e,t,n){let s;const r=this.geometry,a=this.material,o=r.index,l=r.attributes.position,c=r.attributes.uv,u=r.attributes.uv1,p=r.attributes.normal,d=r.groups,g=r.drawRange;if(o!==null)if(Array.isArray(a))for(let x=0,b=d.length;x<b;x++){const m=d[x],h=a[m.materialIndex],A=Math.max(m.start,g.start),P=Math.min(o.count,Math.min(m.start+m.count,g.start+g.count));for(let M=A,T=P;M<T;M+=3){const E=o.getX(M),C=o.getX(M+1),v=o.getX(M+2);s=Qi(this,h,e,n,c,u,p,E,C,v),s&&(s.faceIndex=Math.floor(M/3),s.face.materialIndex=m.materialIndex,t.push(s))}}else{const x=Math.max(0,g.start),b=Math.min(o.count,g.start+g.count);for(let m=x,h=b;m<h;m+=3){const A=o.getX(m),P=o.getX(m+1),M=o.getX(m+2);s=Qi(this,a,e,n,c,u,p,A,P,M),s&&(s.faceIndex=Math.floor(m/3),t.push(s))}}else if(l!==void 0)if(Array.isArray(a))for(let x=0,b=d.length;x<b;x++){const m=d[x],h=a[m.materialIndex],A=Math.max(m.start,g.start),P=Math.min(l.count,Math.min(m.start+m.count,g.start+g.count));for(let M=A,T=P;M<T;M+=3){const E=M,C=M+1,v=M+2;s=Qi(this,h,e,n,c,u,p,E,C,v),s&&(s.faceIndex=Math.floor(M/3),s.face.materialIndex=m.materialIndex,t.push(s))}}else{const x=Math.max(0,g.start),b=Math.min(l.count,g.start+g.count);for(let m=x,h=b;m<h;m+=3){const A=m,P=m+1,M=m+2;s=Qi(this,a,e,n,c,u,p,A,P,M),s&&(s.faceIndex=Math.floor(m/3),t.push(s))}}}}function Qc(i,e,t,n,s,r,a,o){let l;if(e.side===Lt?l=n.intersectTriangle(a,r,s,!0,o):l=n.intersectTriangle(s,r,a,e.side===kn,o),l===null)return null;Ji.copy(o),Ji.applyMatrix4(i.matrixWorld);const c=t.ray.origin.distanceTo(Ji);return c<t.near||c>t.far?null:{distance:c,point:Ji.clone(),object:i}}function Qi(i,e,t,n,s,r,a,o,l,c){i.getVertexPosition(o,ji),i.getVertexPosition(l,Ki),i.getVertexPosition(c,Zi);const u=Qc(i,e,t,n,ji,Ki,Zi,za);if(u){const p=new G;Xt.getBarycoord(za,ji,Ki,Zi,p),s&&(u.uv=Xt.getInterpolatedAttribute(s,o,l,c,p,new Ve)),r&&(u.uv1=Xt.getInterpolatedAttribute(r,o,l,c,p,new Ve)),a&&(u.normal=Xt.getInterpolatedAttribute(a,o,l,c,p,new G),u.normal.dot(n.direction)>0&&u.normal.multiplyScalar(-1));const d={a:o,b:l,c,normal:new G,materialIndex:0};Xt.getNormal(ji,Ki,Zi,d.normal),u.face=d,u.barycoord=p}return u}class ed extends Ct{constructor(e=null,t=1,n=1,s,r,a,o,l,c=St,u=St,p,d){super(null,a,o,l,c,u,s,r,p,d),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}const Fn=new vs,td=new Ve(.5,.5),es=new G;class aa{constructor(e=new Rn,t=new Rn,n=new Rn,s=new Rn,r=new Rn,a=new Rn){this.planes=[e,t,n,s,r,a]}set(e,t,n,s,r,a){const o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(s),o[4].copy(r),o[5].copy(a),this}copy(e){const t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=nn,n=!1){const s=this.planes,r=e.elements,a=r[0],o=r[1],l=r[2],c=r[3],u=r[4],p=r[5],d=r[6],g=r[7],x=r[8],b=r[9],m=r[10],h=r[11],A=r[12],P=r[13],M=r[14],T=r[15];if(s[0].setComponents(c-a,g-u,h-x,T-A).normalize(),s[1].setComponents(c+a,g+u,h+x,T+A).normalize(),s[2].setComponents(c+o,g+p,h+b,T+P).normalize(),s[3].setComponents(c-o,g-p,h-b,T-P).normalize(),n)s[4].setComponents(l,d,m,M).normalize(),s[5].setComponents(c-l,g-d,h-m,T-M).normalize();else if(s[4].setComponents(c-l,g-d,h-m,T-M).normalize(),t===nn)s[5].setComponents(c+l,g+d,h+m,T+M).normalize();else if(t===Ai)s[5].setComponents(l,d,m,M).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),Fn.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{const t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),Fn.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(Fn)}intersectsSprite(e){Fn.center.set(0,0,0);const t=td.distanceTo(e.center);return Fn.radius=.7071067811865476+t,Fn.applyMatrix4(e.matrixWorld),this.intersectsSphere(Fn)}intersectsSphere(e){const t=this.planes,n=e.center,s=-e.radius;for(let r=0;r<6;r++)if(t[r].distanceToPoint(n)<s)return!1;return!0}intersectsBox(e){const t=this.planes;for(let n=0;n<6;n++){const s=t[n];if(es.x=s.normal.x>0?e.max.x:e.min.x,es.y=s.normal.y>0?e.max.y:e.min.y,es.z=s.normal.z>0?e.max.z:e.min.z,s.distanceToPoint(es)<0)return!1}return!0}containsPoint(e){const t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}class Zo extends ui{constructor(e){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new Fe(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}}const ka=new ot,Xr=new jo,ts=new vs,ns=new G;class nd extends Rt{constructor(e=new Kt,t=new Zo){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){const n=this.geometry,s=this.matrixWorld,r=e.params.Points.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),ts.copy(n.boundingSphere),ts.applyMatrix4(s),ts.radius+=r,e.ray.intersectsSphere(ts)===!1)return;ka.copy(s).invert(),Xr.copy(e.ray).applyMatrix4(ka);const o=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=n.index,p=n.attributes.position;if(c!==null){const d=Math.max(0,a.start),g=Math.min(c.count,a.start+a.count);for(let x=d,b=g;x<b;x++){const m=c.getX(x);ns.fromBufferAttribute(p,m),Ha(ns,m,l,s,e,t,this)}}else{const d=Math.max(0,a.start),g=Math.min(p.count,a.start+a.count);for(let x=d,b=g;x<b;x++)ns.fromBufferAttribute(p,x),Ha(ns,x,l,s,e,t,this)}}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const s=t[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){const o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}}function Ha(i,e,t,n,s,r,a){const o=Xr.distanceSqToPoint(i);if(o<t){const l=new G;Xr.closestPointToPoint(i,l),l.applyMatrix4(n);const c=s.ray.origin.distanceTo(l);if(c<s.near||c>s.far)return;r.push({distance:c,distanceToRay:Math.sqrt(o),point:l,index:e,face:null,faceIndex:null,barycoord:null,object:a})}}class $o extends Ct{constructor(e=[],t=Hn,n,s,r,a,o,l,c,u){super(e,t,n,s,r,a,o,l,c,u),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}}class Ci extends Ct{constructor(e,t,n=rn,s,r,a,o=St,l=St,c,u=vn,p=1){if(u!==vn&&u!==zn)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");const d={width:e,height:t,depth:p};super(d,s,r,a,o,l,u,n,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new ra(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){const t=super.toJSON(e);return t.compareFunction=this.compareFunction,t}}class id extends Ci{constructor(e,t=rn,n=Hn,s,r,a=St,o=St,l,c=vn){const u={width:e,height:e,depth:1},p=[u,u,u,u,u,u];super(e,e,t,n,s,r,a,o,l,c),this.image=p,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}}class Jo extends Ct{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}}class Li extends Kt{constructor(e=1,t=1,n=1,s=1,r=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:s,heightSegments:r,depthSegments:a};const o=this;s=Math.floor(s),r=Math.floor(r),a=Math.floor(a);const l=[],c=[],u=[],p=[];let d=0,g=0;x("z","y","x",-1,-1,n,t,e,a,r,0),x("z","y","x",1,-1,n,t,-e,a,r,1),x("x","z","y",1,1,e,n,t,s,a,2),x("x","z","y",1,-1,e,n,-t,s,a,3),x("x","y","z",1,-1,e,t,n,s,r,4),x("x","y","z",-1,-1,e,t,-n,s,r,5),this.setIndex(l),this.setAttribute("position",new _n(c,3)),this.setAttribute("normal",new _n(u,3)),this.setAttribute("uv",new _n(p,2));function x(b,m,h,A,P,M,T,E,C,v,w){const D=M/C,U=T/v,k=M/2,W=T/2,I=E/2,O=C+1,j=v+1;let X=0,ne=0;const q=new G;for(let Q=0;Q<j;Q++){const te=Q*U-W;for(let Ae=0;Ae<O;Ae++){const Te=Ae*D-k;q[b]=Te*A,q[m]=te*P,q[h]=I,c.push(q.x,q.y,q.z),q[b]=0,q[m]=0,q[h]=E>0?1:-1,u.push(q.x,q.y,q.z),p.push(Ae/C),p.push(1-Q/v),X+=1}}for(let Q=0;Q<v;Q++)for(let te=0;te<C;te++){const Ae=d+te+O*Q,Te=d+te+O*(Q+1),et=d+(te+1)+O*(Q+1),Ge=d+(te+1)+O*Q;l.push(Ae,Te,Ge),l.push(Te,et,Ge),ne+=6}o.addGroup(g,ne,w),g+=ne,d+=X}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Li(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}}class Di extends Kt{constructor(e=1,t=1,n=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:s};const r=e/2,a=t/2,o=Math.floor(n),l=Math.floor(s),c=o+1,u=l+1,p=e/o,d=t/l,g=[],x=[],b=[],m=[];for(let h=0;h<u;h++){const A=h*d-a;for(let P=0;P<c;P++){const M=P*p-r;x.push(M,-A,0),b.push(0,0,1),m.push(P/o),m.push(1-h/l)}}for(let h=0;h<l;h++)for(let A=0;A<o;A++){const P=A+c*h,M=A+c*(h+1),T=A+1+c*(h+1),E=A+1+c*h;g.push(P,M,E),g.push(M,T,E)}this.setIndex(g),this.setAttribute("position",new _n(x,3)),this.setAttribute("normal",new _n(b,3)),this.setAttribute("uv",new _n(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Di(e.width,e.height,e.widthSegments,e.heightSegments)}}function di(i){const e={};for(const t in i){e[t]={};for(const n in i[t]){const s=i[t][n];if(Ga(s))s.isRenderTargetTexture?(Re("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][n]=null):e[t][n]=s.clone();else if(Array.isArray(s))if(Ga(s[0])){const r=[];for(let a=0,o=s.length;a<o;a++)r[a]=s[a].clone();e[t][n]=r}else e[t][n]=s.slice();else e[t][n]=s}}return e}function At(i){const e={};for(let t=0;t<i.length;t++){const n=di(i[t]);for(const s in n)e[s]=n[s]}return e}function Ga(i){return i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)}function sd(i){const e=[];for(let t=0;t<i.length;t++)e.push(i[t].clone());return e}function Qo(i){const e=i.getRenderTarget();return e===null?i.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:ke.workingColorSpace}const rd={clone:di,merge:At};var ad=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,od=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class ln extends ui{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=ad,this.fragmentShader=od,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=di(e.uniforms),this.uniformsGroups=sd(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){const t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(const s in this.uniforms){const a=this.uniforms[s].value;a&&a.isTexture?t.uniforms[s]={type:"t",value:a.toJSON(e).uuid}:a&&a.isColor?t.uniforms[s]={type:"c",value:a.getHex()}:a&&a.isVector2?t.uniforms[s]={type:"v2",value:a.toArray()}:a&&a.isVector3?t.uniforms[s]={type:"v3",value:a.toArray()}:a&&a.isVector4?t.uniforms[s]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?t.uniforms[s]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?t.uniforms[s]={type:"m4",value:a.toArray()}:t.uniforms[s]={value:a}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;const n={};for(const s in this.extensions)this.extensions[s]===!0&&(n[s]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(const n in e.uniforms){const s=e.uniforms[n];switch(this.uniforms[n]={},s.type){case"t":this.uniforms[n].value=t[s.value]||null;break;case"c":this.uniforms[n].value=new Fe().setHex(s.value);break;case"v2":this.uniforms[n].value=new Ve().fromArray(s.value);break;case"v3":this.uniforms[n].value=new G().fromArray(s.value);break;case"v4":this.uniforms[n].value=new dt().fromArray(s.value);break;case"m3":this.uniforms[n].value=new Ne().fromArray(s.value);break;case"m4":this.uniforms[n].value=new ot().fromArray(s.value);break;default:this.uniforms[n].value=s.value}}if(e.defines!==void 0&&(this.defines=e.defines),e.vertexShader!==void 0&&(this.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(this.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(this.glslVersion=e.glslVersion),e.extensions!==void 0)for(const n in e.extensions)this.extensions[n]=e.extensions[n];return e.lights!==void 0&&(this.lights=e.lights),e.clipping!==void 0&&(this.clipping=e.clipping),this}}class ld extends ln{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}}class cd extends ui{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new Fe(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Fe(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Vr,this.normalScale=new Ve(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Nn,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class dd extends ui{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=_c,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}}class hd extends ui{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}}class el extends Rt{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new Fe(e),this.intensity=t}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){const t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}}const Zs=new ot,Va=new G,Wa=new G;class ud{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new Ve(512,512),this.mapType=Ot,this.map=null,this.mapPass=null,this.matrix=new ot,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new aa,this._frameExtents=new Ve(1,1),this._viewportCount=1,this._viewports=[new dt(0,0,1,1)]}getViewportCount(){return this._viewportCount}getCamera(){return this.camera}getFrustum(){return this._frustum}updateMatrices(e){const t=this.camera;Va.setFromMatrixPosition(e.matrixWorld),t.position.copy(Va),Wa.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(Wa),t.updateMatrixWorld(),this._updateMatrix(t,this.matrix,this._frustum)}_updateMatrix(e,t,n,s){Zs.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),n.setFromProjectionMatrix(Zs,e.coordinateSystem,e.reversedDepth);const r=this._frameExtents,a=s?s.z/r.x:1,o=s?s.w/r.y:1,l=s?s.x/r.x:0,c=s?s.y/r.y:0;e.coordinateSystem===Ai||e.reversedDepth?t.set(.5*a,0,0,.5*a+l,0,.5*o,0,.5*o+c,0,0,1,0,0,0,0,1):t.set(.5*a,0,0,.5*a+l,0,.5*o,0,.5*o+c,0,0,.5,.5,0,0,0,1),t.multiply(Zs)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){const e={};return e.intensity=this.intensity,e.bias=this.bias,e.normalBias=this.normalBias,e.radius=this.radius,e.blurSamples=this.blurSamples,e.mapSize=this.mapSize.toArray(),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}}const is=new G,ss=new hi,Jt=new G;class tl extends Rt{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new ot,this.projectionMatrix=new ot,this.projectionMatrixInverse=new ot,this.coordinateSystem=nn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(is,ss,Jt),Jt.x===1&&Jt.y===1&&Jt.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(is,ss,Jt.set(1,1,1)).invert()}updateWorldMatrix(e,t,n=!1){super.updateWorldMatrix(e,t,n),this.matrixWorld.decompose(is,ss,Jt),Jt.x===1&&Jt.y===1&&Jt.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(is,ss,Jt.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}}const Cn=new G,Xa=new Ve,qa=new Ve;class Ut extends tl{constructor(e=50,t=1,n=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=s,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){const t=.5*this.getFilmHeight()/e;this.fov=Wr*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){const e=Math.tan(Cs*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return Wr*2*Math.atan(Math.tan(Cs*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){Cn.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(Cn.x,Cn.y).multiplyScalar(-e/Cn.z),Cn.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(Cn.x,Cn.y).multiplyScalar(-e/Cn.z)}getViewSize(e,t){return this.getViewBounds(e,Xa,qa),t.subVectors(qa,Xa)}setViewOffset(e,t,n,s,r,a){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=this.near;let t=e*Math.tan(Cs*.5*this.fov)/this.zoom,n=2*t,s=this.aspect*n,r=-.5*s;const a=this.view;if(this.view!==null&&this.view.enabled){const l=a.fullWidth,c=a.fullHeight;r+=a.offsetX*s/l,t-=a.offsetY*n/c,s*=a.width/l,n*=a.height/c}const o=this.filmOffset;o!==0&&(r+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}}class fd extends ud{constructor(){super(new Ut(90,1,.5,500)),this.isPointLightShadow=!0}}class Ya extends el{constructor(e,t,n=0,s=2){super(e,t),this.isPointLight=!0,this.type="PointLight",this.distance=n,this.decay=s,this.shadow=new fd}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){super.dispose(),this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}toJSON(e){const t=super.toJSON(e);return t.object.distance=this.distance,t.object.decay=this.decay,t.object.shadow=this.shadow.toJSON(),t}}class nl extends tl{constructor(e=-1,t=1,n=1,s=-1,r=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=s,this.near=r,this.far=a,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,s,r,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,s=(this.top+this.bottom)/2;let r=n-e,a=n+e,o=s+t,l=s-t;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,u=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,a=r+c*this.view.width,o-=u*this.view.offsetY,l=o-u*this.view.height}this.projectionMatrix.makeOrthographic(r,a,o,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}}class pd extends el{constructor(e,t){super(e,t),this.isAmbientLight=!0,this.type="AmbientLight"}}const ni=-90,ii=1;class md extends Rt{constructor(e,t,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;const s=new Ut(ni,ii,e,t);s.layers=this.layers,this.add(s);const r=new Ut(ni,ii,e,t);r.layers=this.layers,this.add(r);const a=new Ut(ni,ii,e,t);a.layers=this.layers,this.add(a);const o=new Ut(ni,ii,e,t);o.layers=this.layers,this.add(o);const l=new Ut(ni,ii,e,t);l.layers=this.layers,this.add(l);const c=new Ut(ni,ii,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){const e=this.coordinateSystem,t=this.children.concat(),[n,s,r,a,o,l]=t;for(const c of t)this.remove(c);if(e===nn)n.up.set(0,1,0),n.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===Ai)n.up.set(0,-1,0),n.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(const c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();const{renderTarget:n,activeMipmapLevel:s}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());const[r,a,o,l,c,u]=this.children,p=e.getRenderTarget(),d=e.getActiveCubeFace(),g=e.getActiveMipmapLevel(),x=e.xr.enabled;e.xr.enabled=!1;const b=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let m=!1;e.isWebGLRenderer===!0?m=e.state.buffers.depth.getReversed():m=e.reversedDepthBuffer,e.setRenderTarget(n,0,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,r),e.setRenderTarget(n,1,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(n,2,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(n,3,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),e.setRenderTarget(n,4,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),n.texture.generateMipmaps=b,e.setRenderTarget(n,5,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,u),e.setRenderTarget(p,d,g),e.xr.enabled=x,n.texture.needsPMREMUpdate=!0}}class gd extends Ut{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}}class xd{constructor(e=!0){this.autoStart=e,this.startTime=0,this.oldTime=0,this.elapsedTime=0,this.running=!1,Re("Clock: This module has been deprecated. Please use THREE.Timer instead.")}start(){this.startTime=performance.now(),this.oldTime=this.startTime,this.elapsedTime=0,this.running=!0}stop(){this.getElapsedTime(),this.running=!1,this.autoStart=!1}getElapsedTime(){return this.getDelta(),this.elapsedTime}getDelta(){let e=0;if(this.autoStart&&!this.running)return this.start(),0;if(this.running){const t=performance.now();e=(t-this.oldTime)/1e3,this.oldTime=t,this.elapsedTime+=e}return e}}class il{static{il.prototype.isMatrix2=!0}constructor(e,t,n,s){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,n,s)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let n=0;n<4;n++)this.elements[n]=e[n+t];return this}set(e,t,n,s){const r=this.elements;return r[0]=e,r[2]=t,r[1]=n,r[3]=s,this}}function ja(i,e,t,n){const s=_d(n);switch(t){case zo:return i*e;case Ho:return i*e/s.components*s.byteLength;case ea:return i*e/s.components*s.byteLength;case Gn:return i*e*2/s.components*s.byteLength;case ta:return i*e*2/s.components*s.byteLength;case ko:return i*e*3/s.components*s.byteLength;case qt:return i*e*4/s.components*s.byteLength;case na:return i*e*4/s.components*s.byteLength;case ls:case cs:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case ds:case hs:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case pr:case gr:return Math.max(i,16)*Math.max(e,8)/4;case fr:case mr:return Math.max(i,8)*Math.max(e,8)/2;case xr:case _r:case Sr:case Mr:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case vr:case fs:case br:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case Er:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case yr:return Math.floor((i+4)/5)*Math.floor((e+3)/4)*16;case Tr:return Math.floor((i+4)/5)*Math.floor((e+4)/5)*16;case wr:return Math.floor((i+5)/6)*Math.floor((e+4)/5)*16;case Ar:return Math.floor((i+5)/6)*Math.floor((e+5)/6)*16;case Cr:return Math.floor((i+7)/8)*Math.floor((e+4)/5)*16;case Rr:return Math.floor((i+7)/8)*Math.floor((e+5)/6)*16;case Pr:return Math.floor((i+7)/8)*Math.floor((e+7)/8)*16;case Nr:return Math.floor((i+9)/10)*Math.floor((e+4)/5)*16;case Lr:return Math.floor((i+9)/10)*Math.floor((e+5)/6)*16;case Dr:return Math.floor((i+9)/10)*Math.floor((e+7)/8)*16;case Ir:return Math.floor((i+9)/10)*Math.floor((e+9)/10)*16;case Ur:return Math.floor((i+11)/12)*Math.floor((e+9)/10)*16;case Fr:return Math.floor((i+11)/12)*Math.floor((e+11)/12)*16;case Or:case Br:case zr:return Math.ceil(i/4)*Math.ceil(e/4)*16;case kr:case Hr:return Math.ceil(i/4)*Math.ceil(e/4)*8;case ps:case Gr:return Math.ceil(i/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function _d(i){switch(i){case Ot:case Uo:return{byteLength:1,components:1};case Ti:case Fo:case an:return{byteLength:2,components:1};case Jr:case Qr:return{byteLength:2,components:4};case rn:case $r:case tn:return{byteLength:4,components:1};case Oo:case Bo:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${i}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:Zr}}));typeof window<"u"&&(window.__THREE__?Re("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=Zr);/**
 * @license
 * Copyright 2010-2026 Three.js Authors
 * SPDX-License-Identifier: MIT
 */function sl(){let i=null,e=!1,t=null,n=null;function s(r,a){n=i.requestAnimationFrame(s),t(r,a)}return{start:function(){e!==!0&&t!==null&&i!==null&&(n=i.requestAnimationFrame(s),e=!0)},stop:function(){i!==null&&i.cancelAnimationFrame(n),e=!1},setAnimationLoop:function(r){t=r},setContext:function(r){i=r}}}function vd(i){const e=new WeakMap;function t(o,l){const c=o.array,u=o.usage,p=c.byteLength,d=i.createBuffer();i.bindBuffer(l,d),i.bufferData(l,c,u),o.onUploadCallback();let g;if(c instanceof Float32Array)g=i.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)g=i.HALF_FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?g=i.HALF_FLOAT:g=i.UNSIGNED_SHORT;else if(c instanceof Int16Array)g=i.SHORT;else if(c instanceof Uint32Array)g=i.UNSIGNED_INT;else if(c instanceof Int32Array)g=i.INT;else if(c instanceof Int8Array)g=i.BYTE;else if(c instanceof Uint8Array)g=i.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)g=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:d,type:g,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:p}}function n(o,l,c){const u=l.array,p=l.updateRanges;if(i.bindBuffer(c,o),p.length===0)i.bufferSubData(c,0,u);else{p.sort((g,x)=>g.start-x.start);let d=0;for(let g=1;g<p.length;g++){const x=p[d],b=p[g];b.start<=x.start+x.count+1?x.count=Math.max(x.count,b.start+b.count-x.start):(++d,p[d]=b)}p.length=d+1;for(let g=0,x=p.length;g<x;g++){const b=p[g];i.bufferSubData(c,b.start*u.BYTES_PER_ELEMENT,u,b.start,b.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(o){return o.isInterleavedBufferAttribute&&(o=o.data),e.get(o)}function r(o){o.isInterleavedBufferAttribute&&(o=o.data);const l=e.get(o);l&&(i.deleteBuffer(l.buffer),e.delete(o))}function a(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){const u=e.get(o);(!u||u.version<o.version)&&e.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}const c=e.get(o);if(c===void 0)e.set(o,t(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,o,l),c.version=o.version}}return{get:s,remove:r,update:a}}var Sd=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Md=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,bd=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,Ed=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,yd=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,Td=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,wd=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,Ad=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Cd=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,Rd=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Pd=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Nd=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Ld=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Dd=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,Id=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Ud=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,Fd=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Od=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Bd=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,zd=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,kd=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,Hd=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,Gd=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,Vd=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Wd=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Xd=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,qd=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Yd=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,jd=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Kd=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Zd="gl_FragColor = linearToOutputTexel( gl_FragColor );",$d=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Jd=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,Qd=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,eh=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,th=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,nh=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,ih=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,sh=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,rh=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,ah=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,oh=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,lh=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,ch=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,dh=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,hh=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_SUN_LIGHTS > 0
	struct SunLight {
		vec3 direction;
		vec3 color;
	};
	uniform SunLight sunLights[ NUM_SUN_LIGHTS ];
	void getSunLightInfo( const in SunLight sunLight, out IncidentLight light ) {
		light.color = sunLight.color;
		light.direction = sunLight.direction;
		light.visible = true;
	}
#endif
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,uh=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_RETROREFLECTION
		vec3 getIBLRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 retroVec = normalize( mix( viewDir, normal, pow4( roughness ) ) );
				retroVec = transformDirectionByInverseViewMatrix( retroVec, viewMatrix );
				vec4 envMapColor = textureCubeUV( envMap, envMapRotation * retroVec, roughness );
				return envMapColor.rgb * envMapIntensity;
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
		#ifdef USE_RETROREFLECTION
			vec3 getIBLAnisotropyRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
				#ifdef ENVMAP_TYPE_CUBE_UV
					vec3 bentNormal = cross( bitangent, viewDir );
					bentNormal = normalize( cross( bentNormal, bitangent ) );
					bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
					return getIBLRetroRadiance( viewDir, bentNormal, roughness );
				#else
					return vec3( 0.0 );
				#endif
			}
		#endif
	#endif
#endif`,fh=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,ph=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,mh=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,gh=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,xh=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_RETROREFLECTION
	material.retroreflectivity = retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,_h=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	vec2 dfg;
	vec3 multiScatteringCompensation;
	#ifdef USE_RETROREFLECTION
		float retroreflectivity;
	#endif
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0Dielectric;
		vec3 iridescenceF0Metallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec2 fab, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec2 fab, const in vec3 specularColor, const in float specularF90, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	#ifdef USE_RETROREFLECTION
		vec3 retroViewDir = reflect( - geometryViewDir, geometryNormal );
		vec3 retroSpecularBRDF = BRDF_GGX( directLight.direction, retroViewDir, geometryNormal, material );
		specularBRDF = mix( specularBRDF, retroSpecularBRDF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;
	vec3 halfDir = normalize( directLight.direction + geometryViewDir );
	float dotVH = saturate( dot( geometryViewDir, halfDir ) );
	vec3 F = F_Schlick( material.specularColor, material.specularF90, dotVH );
	#ifdef USE_RETROREFLECTION
		vec3 retroHalfDir = normalize( directLight.direction + retroViewDir );
		float dotRetroVH = saturate( dot( retroViewDir, retroHalfDir ) );
		vec3 retroF = F_Schlick( material.specularColor, material.specularF90, dotRetroVH );
		F = mix( F, retroF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScattering, multiScattering );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScattering, multiScattering );
	#endif
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		sheenSpecularIndirect += irradiance * material.sheenColor * sheenAlbedo * RECIPROCAL_PI;
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( material.dfg, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceF0Metallic, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( material.dfg, material.diffuseColor, material.specularF90, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,vh=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		vec3 iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		vec3 iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( iridescenceFresnelDielectric, iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0Dielectric = Schlick_to_F0( iridescenceFresnelDielectric, 1.0, dotNVi );
		material.iridescenceF0Metallic = Schlick_to_F0( iridescenceFresnelMetallic, 1.0, dotNVi );
	}
#endif
#ifdef STANDARD
	float dotNVms = saturate( dot( geometryNormal, geometryViewDir ) );
	material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;
	#if ( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )
		float EssMs = material.dfg.x + material.dfg.y;
		material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );
	#endif
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SUN_LIGHTS > 0 ) && defined( RE_Direct )
	SunLight sunLight;
	#if defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHTS; i ++ ) {
		sunLight = sunLights[ i ];
		getSunLightInfo( sunLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SUN_LIGHT_SHADOWS )
		sunLightShadow = sunLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Sh=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		vec3 iblRadiance = getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_RETROREFLECTION
		#ifdef USE_ANISOTROPY
			vec3 retroIBLRadiance = getIBLAnisotropyRetroRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
		#else
			vec3 retroIBLRadiance = getIBLRetroRadiance( geometryViewDir, geometryNormal, material.roughness );
		#endif
		iblRadiance = mix( iblRadiance, retroIBLRadiance, saturate( material.retroreflectivity ) );
	#endif
	radiance += iblRadiance;
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,Mh=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,bh=`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,Eh=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,yh=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Th=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,wh=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Ah=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Ch=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Rh=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,Ph=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Nh=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Lh=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Dh=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Ih=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Uh=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Fh=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,Oh=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Bh=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,zh=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,kh=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Hh=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Gh=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,Vh=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Wh=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Xh=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,qh=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Yh=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,jh=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Kh=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,Zh=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,$h=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Jh=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Qh=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,eu=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,tu=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,nu=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		#define SUN_LIGHT_CASCADES 2
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#else
			uniform sampler2D sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#endif
		uniform mat4 sunShadowMatrix[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		uniform vec4 sunShadowCascade[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
		struct SunLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SunLightShadow sunLightShadows[ NUM_SUN_LIGHT_SHADOWS ];
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_SUN_LIGHT_SHADOWS > 0
		float getSunShadow(
			#if defined( SHADOWMAP_TYPE_PCF )
				sampler2DShadow shadowMap,
			#else
				sampler2D shadowMap,
			#endif
			SunLightShadow sunLightShadow,
			int shadowIndex
		) {
			vec4 shadowWorldPosition = vec4( vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * sunLightShadow.shadowNormalBias, 1.0 );
			float viewDepth = vSunShadowWorldPosition.w;
			int cascadeOffset = shadowIndex * SUN_LIGHT_CASCADES;
			float shadow = 1.0;
			for ( int i = SUN_LIGHT_CASCADES - 1; i >= 0; i -- ) {
				vec4 cascade = sunShadowCascade[ cascadeOffset + i ];
				if ( viewDepth >= cascade.x && viewDepth < cascade.y ) {
					float cascadeShadow = getShadow(
						shadowMap,
						sunLightShadow.shadowMapSize,
						sunLightShadow.shadowIntensity,
						sunLightShadow.shadowBias,
						sunLightShadow.shadowRadius,
						sunShadowMatrix[ cascadeOffset + i ] * shadowWorldPosition
					);
					shadow = mix( cascadeShadow, shadow, smoothstep( cascade.z, cascade.y, viewDepth ) );
				}
			}
			return shadow;
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,iu=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,su=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_SUN_LIGHT_SHADOWS > 0
		vSunShadowWorldPosition = vec4( worldPosition.xyz, - mvPosition.z );
		vSunShadowWorldNormal = shadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,ru=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHT_SHADOWS; i ++ ) {
		sunLight = sunLightShadows[ i ];
		shadow *= receiveShadow ? getSunShadow( sunShadowMap[ i ], sunLight, UNROLLED_LOOP_INDEX ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,au=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,ou=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,lu=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,cu=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,du=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,hu=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,uu=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,fu=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,pu=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,mu=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,gu=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,xu=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,_u=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,vu=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const Su=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Mu=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,bu=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Eu=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,yu=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Tu=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,wu=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,Au=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,Cu=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,Ru=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,Pu=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Nu=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Lu=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Du=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Iu=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,Uu=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Fu=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Ou=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Bu=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,zu=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,ku=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,Hu=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,Gu=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Vu=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Wu=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,Xu=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_RETROREFLECTION
	uniform float retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,qu=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Yu=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,ju=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,Ku=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Zu=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,$u=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Ju=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Qu=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Ie={alphahash_fragment:Sd,alphahash_pars_fragment:Md,alphamap_fragment:bd,alphamap_pars_fragment:Ed,alphatest_fragment:yd,alphatest_pars_fragment:Td,aomap_fragment:wd,aomap_pars_fragment:Ad,batching_pars_vertex:Cd,batching_vertex:Rd,begin_vertex:Pd,beginnormal_vertex:Nd,bsdfs:Ld,iridescence_fragment:Dd,bumpmap_pars_fragment:Id,clipping_planes_fragment:Ud,clipping_planes_pars_fragment:Fd,clipping_planes_pars_vertex:Od,clipping_planes_vertex:Bd,color_fragment:zd,color_pars_fragment:kd,color_pars_vertex:Hd,color_vertex:Gd,common:Vd,cube_uv_reflection_fragment:Wd,defaultnormal_vertex:Xd,displacementmap_pars_vertex:qd,displacementmap_vertex:Yd,emissivemap_fragment:jd,emissivemap_pars_fragment:Kd,colorspace_fragment:Zd,colorspace_pars_fragment:$d,envmap_fragment:Jd,envmap_common_pars_fragment:Qd,envmap_pars_fragment:eh,envmap_pars_vertex:th,envmap_physical_pars_fragment:uh,envmap_vertex:nh,fog_vertex:ih,fog_pars_vertex:sh,fog_fragment:rh,fog_pars_fragment:ah,gradientmap_pars_fragment:oh,lightmap_pars_fragment:lh,lights_lambert_fragment:ch,lights_lambert_pars_fragment:dh,lights_pars_begin:hh,lights_toon_fragment:fh,lights_toon_pars_fragment:ph,lights_phong_fragment:mh,lights_phong_pars_fragment:gh,lights_physical_fragment:xh,lights_physical_pars_fragment:_h,lights_fragment_begin:vh,lights_fragment_maps:Sh,lights_fragment_end:Mh,lightprobes_pars_fragment:bh,logdepthbuf_fragment:Eh,logdepthbuf_pars_fragment:yh,logdepthbuf_pars_vertex:Th,logdepthbuf_vertex:wh,map_fragment:Ah,map_pars_fragment:Ch,map_particle_fragment:Rh,map_particle_pars_fragment:Ph,metalnessmap_fragment:Nh,metalnessmap_pars_fragment:Lh,morphinstance_vertex:Dh,morphcolor_vertex:Ih,morphnormal_vertex:Uh,morphtarget_pars_vertex:Fh,morphtarget_vertex:Oh,normal_fragment_begin:Bh,normal_fragment_maps:zh,normal_pars_fragment:kh,normal_pars_vertex:Hh,normal_vertex:Gh,normalmap_pars_fragment:Vh,clearcoat_normal_fragment_begin:Wh,clearcoat_normal_fragment_maps:Xh,clearcoat_pars_fragment:qh,iridescence_pars_fragment:Yh,opaque_fragment:jh,packing:Kh,premultiplied_alpha_fragment:Zh,project_vertex:$h,dithering_fragment:Jh,dithering_pars_fragment:Qh,roughnessmap_fragment:eu,roughnessmap_pars_fragment:tu,shadowmap_pars_fragment:nu,shadowmap_pars_vertex:iu,shadowmap_vertex:su,shadowmask_pars_fragment:ru,skinbase_vertex:au,skinning_pars_vertex:ou,skinning_vertex:lu,skinnormal_vertex:cu,specularmap_fragment:du,specularmap_pars_fragment:hu,tonemapping_fragment:uu,tonemapping_pars_fragment:fu,transmission_fragment:pu,transmission_pars_fragment:mu,uv_pars_fragment:gu,uv_pars_vertex:xu,uv_vertex:_u,worldpos_vertex:vu,background_vert:Su,background_frag:Mu,backgroundCube_vert:bu,backgroundCube_frag:Eu,cube_vert:yu,cube_frag:Tu,depth_vert:wu,depth_frag:Au,distance_vert:Cu,distance_frag:Ru,equirect_vert:Pu,equirect_frag:Nu,linedashed_vert:Lu,linedashed_frag:Du,meshbasic_vert:Iu,meshbasic_frag:Uu,meshlambert_vert:Fu,meshlambert_frag:Ou,meshmatcap_vert:Bu,meshmatcap_frag:zu,meshnormal_vert:ku,meshnormal_frag:Hu,meshphong_vert:Gu,meshphong_frag:Vu,meshphysical_vert:Wu,meshphysical_frag:Xu,meshtoon_vert:qu,meshtoon_frag:Yu,points_vert:ju,points_frag:Ku,shadow_vert:Zu,shadow_frag:$u,sprite_vert:Ju,sprite_frag:Qu},he={common:{diffuse:{value:new Fe(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Ne},alphaMap:{value:null},alphaMapTransform:{value:new Ne},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Ne}},envmap:{envMap:{value:null},envMapRotation:{value:new Ne},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Ne}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Ne}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Ne},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Ne},normalScale:{value:new Ve(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Ne},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Ne}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Ne}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Ne}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Fe(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new G},probesMax:{value:new G},probesResolution:{value:new G}},points:{diffuse:{value:new Fe(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Ne},alphaTest:{value:0},uvTransform:{value:new Ne}},sprite:{diffuse:{value:new Fe(16777215)},opacity:{value:1},center:{value:new Ve(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Ne},alphaMap:{value:null},alphaMapTransform:{value:new Ne},alphaTest:{value:0}}},en={basic:{uniforms:At([he.common,he.specularmap,he.envmap,he.aomap,he.lightmap,he.fog]),vertexShader:Ie.meshbasic_vert,fragmentShader:Ie.meshbasic_frag},lambert:{uniforms:At([he.common,he.specularmap,he.envmap,he.aomap,he.lightmap,he.emissivemap,he.bumpmap,he.normalmap,he.displacementmap,he.fog,he.lights,{emissive:{value:new Fe(0)},envMapIntensity:{value:1}}]),vertexShader:Ie.meshlambert_vert,fragmentShader:Ie.meshlambert_frag},phong:{uniforms:At([he.common,he.specularmap,he.envmap,he.aomap,he.lightmap,he.emissivemap,he.bumpmap,he.normalmap,he.displacementmap,he.fog,he.lights,{emissive:{value:new Fe(0)},specular:{value:new Fe(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Ie.meshphong_vert,fragmentShader:Ie.meshphong_frag},standard:{uniforms:At([he.common,he.envmap,he.aomap,he.lightmap,he.emissivemap,he.bumpmap,he.normalmap,he.displacementmap,he.roughnessmap,he.metalnessmap,he.fog,he.lights,{emissive:{value:new Fe(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Ie.meshphysical_vert,fragmentShader:Ie.meshphysical_frag},toon:{uniforms:At([he.common,he.aomap,he.lightmap,he.emissivemap,he.bumpmap,he.normalmap,he.displacementmap,he.gradientmap,he.fog,he.lights,{emissive:{value:new Fe(0)}}]),vertexShader:Ie.meshtoon_vert,fragmentShader:Ie.meshtoon_frag},matcap:{uniforms:At([he.common,he.bumpmap,he.normalmap,he.displacementmap,he.fog,{matcap:{value:null}}]),vertexShader:Ie.meshmatcap_vert,fragmentShader:Ie.meshmatcap_frag},points:{uniforms:At([he.points,he.fog]),vertexShader:Ie.points_vert,fragmentShader:Ie.points_frag},dashed:{uniforms:At([he.common,he.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Ie.linedashed_vert,fragmentShader:Ie.linedashed_frag},depth:{uniforms:At([he.common,he.displacementmap]),vertexShader:Ie.depth_vert,fragmentShader:Ie.depth_frag},normal:{uniforms:At([he.common,he.bumpmap,he.normalmap,he.displacementmap,{opacity:{value:1}}]),vertexShader:Ie.meshnormal_vert,fragmentShader:Ie.meshnormal_frag},sprite:{uniforms:At([he.sprite,he.fog]),vertexShader:Ie.sprite_vert,fragmentShader:Ie.sprite_frag},background:{uniforms:{uvTransform:{value:new Ne},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Ie.background_vert,fragmentShader:Ie.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Ne}},vertexShader:Ie.backgroundCube_vert,fragmentShader:Ie.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Ie.cube_vert,fragmentShader:Ie.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Ie.equirect_vert,fragmentShader:Ie.equirect_frag},distance:{uniforms:At([he.common,he.displacementmap,{referencePosition:{value:new G},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Ie.distance_vert,fragmentShader:Ie.distance_frag},shadow:{uniforms:At([he.lights,he.fog,{color:{value:new Fe(0)},opacity:{value:1}}]),vertexShader:Ie.shadow_vert,fragmentShader:Ie.shadow_frag}};en.physical={uniforms:At([en.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Ne},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Ne},clearcoatNormalScale:{value:new Ve(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Ne},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Ne},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Ne},sheen:{value:0},sheenColor:{value:new Fe(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Ne},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Ne},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Ne},transmissionSamplerSize:{value:new Ve},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Ne},attenuationDistance:{value:0},attenuationColor:{value:new Fe(0)},specularColor:{value:new Fe(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Ne},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Ne},anisotropyVector:{value:new Ve},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Ne}}]),vertexShader:Ie.meshphysical_vert,fragmentShader:Ie.meshphysical_frag};const rs={r:0,b:0,g:0},ef=new ot,rl=new Ne;rl.set(-1,0,0,0,1,0,0,0,1);function tf(i,e,t,n,s,r){const a=new Fe(0);let o=s===!0?0:1,l,c,u=null,p=0,d=null;function g(A){let P=A.isScene===!0?A.background:null;if(P&&P.isTexture){const M=A.backgroundBlurriness>0;P=e.get(P,M)}return P}function x(A){let P=!1;const M=g(A);M===null?m(a,o):M&&M.isColor&&(m(M,1),P=!0);const T=i.xr.getEnvironmentBlendMode();T==="additive"?t.buffers.color.setClear(0,0,0,1,r):T==="alpha-blend"&&t.buffers.color.setClear(0,0,0,0,r),(i.autoClear||P)&&(t.buffers.depth.setTest(!0),t.buffers.depth.setMask(!0),t.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function b(A,P){const M=g(P);M&&(M.isCubeTexture||M.mapping===_s)?(c===void 0&&(c=new on(new Li(1,1,1),new ln({name:"BackgroundCubeMaterial",uniforms:di(en.backgroundCube.uniforms),vertexShader:en.backgroundCube.vertexShader,fragmentShader:en.backgroundCube.fragmentShader,side:Lt,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(T,E,C){this.matrixWorld.copyPosition(C.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),n.update(c)),c.material.uniforms.envMap.value=M,c.material.uniforms.backgroundBlurriness.value=P.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=P.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(ef.makeRotationFromEuler(P.backgroundRotation)).transpose(),M.isCubeTexture&&M.isRenderTargetTexture===!1&&c.material.uniforms.backgroundRotation.value.premultiply(rl),c.material.toneMapped=ke.getTransfer(M.colorSpace)!==$e,(u!==M||p!==M.version||d!==i.toneMapping)&&(c.material.needsUpdate=!0,u=M,p=M.version,d=i.toneMapping),c.layers.enableAll(),A.unshift(c,c.geometry,c.material,0,0,null)):M&&M.isTexture&&(l===void 0&&(l=new on(new Di(2,2),new ln({name:"BackgroundMaterial",uniforms:di(en.background.uniforms),vertexShader:en.background.vertexShader,fragmentShader:en.background.fragmentShader,side:kn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),n.update(l)),l.material.uniforms.t2D.value=M,l.material.uniforms.backgroundIntensity.value=P.backgroundIntensity,l.material.toneMapped=ke.getTransfer(M.colorSpace)!==$e,M.matrixAutoUpdate===!0&&M.updateMatrix(),l.material.uniforms.uvTransform.value.copy(M.matrix),(u!==M||p!==M.version||d!==i.toneMapping)&&(l.material.needsUpdate=!0,u=M,p=M.version,d=i.toneMapping),l.layers.enableAll(),A.unshift(l,l.geometry,l.material,0,0,null))}function m(A,P){A.getRGB(rs,Qo(i)),t.buffers.color.setClear(rs.r,rs.g,rs.b,P,r)}function h(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return a},setClearColor:function(A,P=1){a.set(A),o=P,m(a,o)},getClearAlpha:function(){return o},setClearAlpha:function(A){o=A,m(a,o)},render:x,addToRenderList:b,dispose:h}}function nf(i,e){const t=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},s=d(null);let r=s,a=!1;function o(U,k,W,I,O){let j=!1;const X=p(U,I,W,k);r!==X&&(r=X,c(r.object)),j=g(U,I,W,O),j&&x(U,I,W,O),O!==null&&e.update(O,i.ELEMENT_ARRAY_BUFFER),(j||a)&&(a=!1,M(U,k,W,I),O!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,e.get(O).buffer))}function l(){return i.createVertexArray()}function c(U){return i.bindVertexArray(U)}function u(U){return i.deleteVertexArray(U)}function p(U,k,W,I){const O=I.wireframe===!0;let j=n[k.id];j===void 0&&(j={},n[k.id]=j);const X=U.isInstancedMesh===!0?U.id:0;let ne=j[X];ne===void 0&&(ne={},j[X]=ne);let q=ne[W.id];q===void 0&&(q={},ne[W.id]=q);let Q=q[O];return Q===void 0&&(Q=d(l()),q[O]=Q),Q}function d(U){const k=[],W=[],I=[];for(let O=0;O<t;O++)k[O]=0,W[O]=0,I[O]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:k,enabledAttributes:W,attributeDivisors:I,object:U,attributes:{},index:null}}function g(U,k,W,I){const O=r.attributes,j=k.attributes;let X=0;const ne=W.getAttributes();for(const q in ne)if(ne[q].location>=0){const te=O[q];let Ae=j[q];if(Ae===void 0&&(q==="instanceMatrix"&&U.instanceMatrix&&(Ae=U.instanceMatrix),q==="instanceColor"&&U.instanceColor&&(Ae=U.instanceColor)),te===void 0||te.attribute!==Ae||Ae&&te.data!==Ae.data)return!0;X++}return r.attributesNum!==X||r.index!==I}function x(U,k,W,I){const O={},j=k.attributes;let X=0;const ne=W.getAttributes();for(const q in ne)if(ne[q].location>=0){let te=j[q];te===void 0&&(q==="instanceMatrix"&&U.instanceMatrix&&(te=U.instanceMatrix),q==="instanceColor"&&U.instanceColor&&(te=U.instanceColor));const Ae={};Ae.attribute=te,te&&te.data&&(Ae.data=te.data),O[q]=Ae,X++}r.attributes=O,r.attributesNum=X,r.index=I}function b(){const U=r.newAttributes;for(let k=0,W=U.length;k<W;k++)U[k]=0}function m(U){h(U,0)}function h(U,k){const W=r.newAttributes,I=r.enabledAttributes,O=r.attributeDivisors;W[U]=1,I[U]===0&&(i.enableVertexAttribArray(U),I[U]=1),O[U]!==k&&(i.vertexAttribDivisor(U,k),O[U]=k)}function A(){const U=r.newAttributes,k=r.enabledAttributes;for(let W=0,I=k.length;W<I;W++)k[W]!==U[W]&&(i.disableVertexAttribArray(W),k[W]=0)}function P(U,k,W,I,O,j,X){X===!0?i.vertexAttribIPointer(U,k,W,O,j):i.vertexAttribPointer(U,k,W,I,O,j)}function M(U,k,W,I){b();const O=I.attributes,j=W.getAttributes(),X=k.defaultAttributeValues;for(const ne in j){const q=j[ne];if(q.location>=0){let Q=O[ne];if(Q===void 0&&(ne==="instanceMatrix"&&U.instanceMatrix&&(Q=U.instanceMatrix),ne==="instanceColor"&&U.instanceColor&&(Q=U.instanceColor)),Q!==void 0){const te=Q.normalized,Ae=Q.itemSize,Te=e.get(Q);if(Te===void 0)continue;const et=Te.buffer,Ge=Te.type,Ye=Te.bytesPerElement,K=Ge===i.INT||Ge===i.UNSIGNED_INT||Q.gpuType===$r;if(Q.isInterleavedBufferAttribute){const ee=Q.data,_e=ee.stride,Pe=Q.offset;if(ee.isInstancedInterleavedBuffer){for(let ge=0;ge<q.locationSize;ge++)h(q.location+ge,ee.meshPerAttribute);U.isInstancedMesh!==!0&&I._maxInstanceCount===void 0&&(I._maxInstanceCount=ee.meshPerAttribute*ee.count)}else for(let ge=0;ge<q.locationSize;ge++)m(q.location+ge);i.bindBuffer(i.ARRAY_BUFFER,et);for(let ge=0;ge<q.locationSize;ge++)P(q.location+ge,Ae/q.locationSize,Ge,te,_e*Ye,(Pe+Ae/q.locationSize*ge)*Ye,K)}else{if(Q.isInstancedBufferAttribute){for(let ee=0;ee<q.locationSize;ee++)h(q.location+ee,Q.meshPerAttribute);U.isInstancedMesh!==!0&&I._maxInstanceCount===void 0&&(I._maxInstanceCount=Q.meshPerAttribute*Q.count)}else for(let ee=0;ee<q.locationSize;ee++)m(q.location+ee);i.bindBuffer(i.ARRAY_BUFFER,et);for(let ee=0;ee<q.locationSize;ee++)P(q.location+ee,Ae/q.locationSize,Ge,te,Ae*Ye,Ae/q.locationSize*ee*Ye,K)}}else if(X!==void 0){const te=X[ne];if(te!==void 0)switch(te.length){case 2:i.vertexAttrib2fv(q.location,te);break;case 3:i.vertexAttrib3fv(q.location,te);break;case 4:i.vertexAttrib4fv(q.location,te);break;default:i.vertexAttrib1fv(q.location,te)}}}}A()}function T(){w();for(const U in n){const k=n[U];for(const W in k){const I=k[W];for(const O in I){const j=I[O];for(const X in j)u(j[X].object),delete j[X];delete I[O]}}delete n[U]}}function E(U){if(n[U.id]===void 0)return;const k=n[U.id];for(const W in k){const I=k[W];for(const O in I){const j=I[O];for(const X in j)u(j[X].object),delete j[X];delete I[O]}}delete n[U.id]}function C(U){for(const k in n){const W=n[k];for(const I in W){const O=W[I];if(O[U.id]===void 0)continue;const j=O[U.id];for(const X in j)u(j[X].object),delete j[X];delete O[U.id]}}}function v(U){for(const k in n){const W=n[k],I=U.isInstancedMesh===!0?U.id:0,O=W[I];if(O!==void 0){for(const j in O){const X=O[j];for(const ne in X)u(X[ne].object),delete X[ne];delete O[j]}delete W[I],Object.keys(W).length===0&&delete n[k]}}}function w(){D(),a=!0,r!==s&&(r=s,c(r.object))}function D(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:o,reset:w,resetDefaultState:D,dispose:T,releaseStatesOfGeometry:E,releaseStatesOfObject:v,releaseStatesOfProgram:C,initAttributes:b,enableAttribute:m,disableUnusedAttributes:A}}function sf(i,e,t){let n;function s(l){n=l}function r(l,c){i.drawArrays(n,l,c),t.update(c,n,1)}function a(l,c,u){u!==0&&(i.drawArraysInstanced(n,l,c,u),t.update(c,n,u))}function o(l,c,u){if(u===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,l,0,c,0,u);let d=0;for(let g=0;g<u;g++)d+=c[g];t.update(d,n,1)}this.setMode=s,this.render=r,this.renderInstances=a,this.renderMultiDraw=o}function rf(i,e,t,n){let s;function r(){if(s!==void 0)return s;if(e.has("EXT_texture_filter_anisotropic")===!0){const C=e.get("EXT_texture_filter_anisotropic");s=i.getParameter(C.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function a(C){return!(C!==qt&&n.convert(C)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(C){const v=C===an&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(C!==Ot&&C!==tn&&!v&&n.convert(C)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE))}function l(C){if(C==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";C="mediump"}return C==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp";const u=l(c);u!==c&&(Re("WebGLRenderer:",c,"not supported, using",u,"instead."),c=u);const p=t.logarithmicDepthBuffer===!0,d=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control");t.reversedDepthBuffer===!0&&d===!1&&Re("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");const g=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),x=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),b=i.getParameter(i.MAX_TEXTURE_SIZE),m=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),h=i.getParameter(i.MAX_VERTEX_ATTRIBS),A=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),P=i.getParameter(i.MAX_VARYING_VECTORS),M=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),T=i.getParameter(i.MAX_SAMPLES),E=i.getParameter(i.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:a,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:p,reversedDepthBuffer:d,maxTextures:g,maxVertexTextures:x,maxTextureSize:b,maxCubemapSize:m,maxAttributes:h,maxVertexUniforms:A,maxVaryings:P,maxFragmentUniforms:M,maxSamples:T,samples:E}}function af(i){const e=this;let t=null,n=0,s=!1,r=!1;const a=new Rn,o=new Ne,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(p,d){const g=p.length!==0||d||n!==0||s;return s=d,n=p.length,g},this.beginShadows=function(){r=!0,u(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(p,d){t=u(p,d,0)},this.setState=function(p,d,g){const x=p.clippingPlanes,b=p.clipIntersection,m=p.clipShadows,h=i.get(p);if(!s||x===null||x.length===0||r&&!m)r?u(null):c();else{const A=r?0:n,P=A*4;let M=h.clippingState||null;l.value=M,M=u(x,d,P,g);for(let T=0;T!==P;++T)M[T]=t[T];h.clippingState=M,this.numIntersection=b?this.numPlanes:0,this.numPlanes+=A}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=n>0),e.numPlanes=n,e.numIntersection=0}function u(p,d,g,x){const b=p!==null?p.length:0;let m=null;if(b!==0){if(m=l.value,x!==!0||m===null){const h=g+b*4,A=d.matrixWorldInverse;o.getNormalMatrix(A),(m===null||m.length<h)&&(m=new Float32Array(h));for(let P=0,M=g;P!==b;++P,M+=4)a.copy(p[P]).applyMatrix4(A,o),a.normal.toArray(m,M),m[M+3]=a.constant}l.value=m,l.needsUpdate=!0}return e.numPlanes=b,e.numIntersection=0,m}}const ai=4,of=6,lf=20,cf=256,vi=new nl,Ka=new Fe;let $s=null,Js=0,Qs=0,er=!1;const df=new G,On=new G;class Za{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,n=.1,s=100,r={}){const{size:a=256,position:o=df}=r;$s=this._renderer.getRenderTarget(),Js=this._renderer.getActiveCubeFace(),Qs=this._renderer.getActiveMipmapLevel(),er=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(a);const l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(e,n,s,l,o),t>0&&this._blur(l,0,0,t),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Qa(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Ja(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget($s,Js,Qs),this._renderer.xr.enabled=er,e.scissorTest=!1,si(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===Hn||e.mapping===ci?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),$s=this._renderer.getRenderTarget(),Js=this._renderer.getActiveCubeFace(),Qs=this._renderer.getActiveMipmapLevel(),er=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){const e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:Tt,minFilter:Tt,generateMipmaps:!1,type:an,format:qt,colorSpace:ms,depthBuffer:!1},s=$a(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=$a(e,t,n);const{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods}=hf(r)),this._blurMaterial=ff(r,e,t),this._ggxMaterial=uf(r,e,t)}return s}_compileMaterial(e){const t=new on(new Kt,e);this._renderer.compile(t,vi)}_sceneToCubeUV(e,t,n,s,r){const l=new Ut(90,1,t,n),c=[1,-1,1,1,1,1],u=[1,1,1,-1,-1,-1],p=this._renderer,d=p.autoClear,g=p.toneMapping;p.getClearColor(Ka),p.toneMapping=sn,p.autoClear=!1,p.state.buffers.depth.getReversed()&&(p.setRenderTarget(s),p.clearDepth(),p.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new on(new Li,new Ko({name:"PMREM.Background",side:Lt,depthWrite:!1,depthTest:!1})));const b=this._backgroundBox,m=b.material;let h=!1;const A=e.background;A?A.isColor&&(m.color.copy(A),e.background=null,h=!0):(m.color.copy(Ka),h=!0);for(let P=0;P<6;P++){const M=P%3;M===0?(l.up.set(0,c[P],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x+u[P],r.y,r.z)):M===1?(l.up.set(0,0,c[P]),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y+u[P],r.z)):(l.up.set(0,c[P],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y,r.z+u[P]));const T=this._cubeSize;si(s,M*T,P>2?T:0,T,T),p.setRenderTarget(s),h&&p.render(b,l),p.render(e,l)}p.toneMapping=g,p.autoClear=d,e.background=A}_textureToCubeUV(e,t){const n=this._renderer,s=e.mapping===Hn||e.mapping===ci;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=Qa()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Ja());const r=s?this._cubemapMaterial:this._equirectMaterial,a=this._lodMeshes[0];a.material=r;const o=r.uniforms;o.envMap.value=e;const l=this._cubeSize;si(t,0,0,3*l,2*l),n.setRenderTarget(t),n.render(a,vi)}_applyPMREM(e){const t=this._renderer,n=t.autoClear;t.autoClear=!1;const s=this._lodMeshes.length;for(let r=1;r<s;r++)this._applyGGXFilter(e,r-1,r);t.autoClear=n}_applyGGXFilter(e,t,n){const s=this._renderer,r=this._pingPongRenderTarget,a=this._ggxMaterial,o=this._lodMeshes[n];o.material=a;const l=a.uniforms,c=n/(this._lodMeshes.length-1),u=t/(this._lodMeshes.length-1),p=Math.sqrt(c*c-u*u),d=c*1.25,g=p*d,{_lodMax:x}=this,b=this._sizeLods[n],m=3*b*(n>x-ai?n-x+ai:0),h=4*(this._cubeSize-b);l.envMap.value=e.texture,l.roughness.value=g,l.mipInt.value=x-t,si(r,m,h,3*b,2*b),s.setRenderTarget(r),s.render(o,vi),l.envMap.value=r.texture,l.roughness.value=0,l.mipInt.value=x-n,si(e,m,h,3*b,2*b),s.setRenderTarget(e),s.render(o,vi)}_blur(e,t,n,s){const r=this._pingPongRenderTarget,a=Math.min(s,Math.PI)/Math.SQRT2;this._blurPass(e,r,t,n,a),this._blurPass(r,e,n,n,a)}_blurPass(e,t,n,s,r){const a=this._renderer,o=this._blurMaterial,l=this._lodMeshes[s];l.material=o;const c=o.uniforms;c.envMap.value=e.texture,c.sigma.value=r,c.mipInt.value=this._lodMax-n;const u=this._sizeLods[s],p=3*u*(s>this._lodMax-ai?s-this._lodMax+ai:0),d=4*(this._cubeSize-u);si(t,p,d,3*u,2*u),a.setRenderTarget(t),a.render(l,vi)}}function hf(i){const e=[],t=[];let n=i;const s=i-ai+1+of;for(let r=0;r<s;r++){const a=Math.pow(2,n);e.push(a);const o=1/(a-2),l=-o,c=1+o,u=[l,l,c,l,c,c,l,l,c,c,l,c],p=6,d=6,g=3,x=new Float32Array(g*d*p),b=new Float32Array(g*d*p);for(let h=0;h<p;h++){const A=h%3*2/3-1,P=h>2?0:-1,M=[A,P,0,A+2/3,P,0,A+2/3,P+1,0,A,P,0,A+2/3,P+1,0,A,P+1,0];x.set(M,g*d*h);for(let T=0;T<d;T++){const E=u[T*2]*2-1,C=u[T*2+1]*2-1;h===0?On.set(1,C,E):h===1?On.set(-E,1,-C):h===2?On.set(-E,C,1):h===3?On.set(-1,C,-E):h===4?On.set(-E,-1,C):On.set(E,C,-1),On.toArray(b,(h*d+T)*g)}}const m=new Kt;m.setAttribute("position",new jt(x,g)),m.setAttribute("outputDirection",new jt(b,g)),t.push(new on(m,null)),n>ai&&n--}return{lodMeshes:t,sizeLods:e}}function $a(i,e,t){const n=new Yt(i,e,t);return n.texture.mapping=_s,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function si(i,e,t,n,s){i.viewport.set(e,t,n,s),i.scissor.set(e,t,n,s)}function uf(i,e,t){return new ln({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:cf,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:Ss(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:gn,depthTest:!1,depthWrite:!1})}function ff(i,e,t){return new ln({name:"SphericalGaussianBlur",defines:{SAMPLES:lf,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},sigma:{value:0},mipInt:{value:0}},vertexShader:Ss(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float sigma;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359
			#define GOLDEN_ANGLE 2.39996322973

			void main() {

				if ( sigma == 0.0 ) {

					gl_FragColor = vec4( bilinearCubeUV( envMap, vOutputDirection, mipInt ), 1.0 );
					return;

				}

				vec3 outputDirection = normalize( vOutputDirection );

				vec3 up = abs( outputDirection.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
				vec3 tangent = normalize( cross( up, outputDirection ) );
				vec3 bitangent = cross( outputDirection, tangent );

				// Truncate the kernel at three standard deviations or at the antipode.
				float thetaMax = min( 3.0 * sigma, PI );
				float truncation = 1.0 - exp( - 0.5 * thetaMax * thetaMax / ( sigma * sigma ) );

				vec3 accumColor = vec3( 0.0 );
				float accumWeight = 0.0;

				for ( int i = 0; i < SAMPLES; i ++ ) {

					// Stratified inverse-CDF sampling of the Gaussian, placed on a golden-angle spiral.
					float stratum = ( float( i ) + 0.5 ) / float( SAMPLES );
					float theta = sigma * sqrt( - 2.0 * log( 1.0 - stratum * truncation ) );
					float phi = float( i ) * GOLDEN_ANGLE;

					vec3 offset = cos( phi ) * tangent + sin( phi ) * bitangent;
					vec3 sampleDirection = cos( theta ) * outputDirection + sin( theta ) * offset;

					// Correct the planar sample density to solid angle.
					float weight = sin( theta ) / theta;

					accumColor += weight * bilinearCubeUV( envMap, sampleDirection, mipInt );
					accumWeight += weight;

				}

				gl_FragColor = vec4( accumColor / accumWeight, 1.0 );

			}
		`,blending:gn,depthTest:!1,depthWrite:!1})}function Ja(){return new ln({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Ss(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:gn,depthTest:!1,depthWrite:!1})}function Qa(){return new ln({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Ss(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:gn,depthTest:!1,depthWrite:!1})}function Ss(){return`

		precision mediump float;
		precision mediump int;

		attribute vec3 outputDirection;

		varying vec3 vOutputDirection;

		void main() {

			vOutputDirection = outputDirection;
			gl_Position = vec4( position, 1.0 );

		}
	`}class al extends Yt{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;const n={width:e,height:e,depth:1},s=[n,n,n,n,n,n];this.texture=new $o(s),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;const n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},s=new Li(5,5,5),r=new ln({name:"CubemapFromEquirect",uniforms:di(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:Lt,blending:gn});r.uniforms.tEquirect.value=t;const a=new on(s,r),o=t.minFilter;return t.minFilter===Bn&&(t.minFilter=Tt),new md(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t=!0,n=!0,s=!0){const r=e.getRenderTarget();for(let a=0;a<6;a++)e.setRenderTarget(this,a),e.clear(t,n,s);e.setRenderTarget(r)}}function pf(i){let e=new WeakMap,t=new WeakMap,n=null;function s(d,g=!1){return d==null?null:g?a(d):r(d)}function r(d){if(d&&d.isTexture){const g=d.mapping;if(g===ys||g===Ts)if(e.has(d)){const x=e.get(d).texture;return o(x,d.mapping)}else{const x=d.image;if(x&&x.height>0){const b=new al(x.height);return b.fromEquirectangularTexture(i,d),e.set(d,b),d.addEventListener("dispose",c),o(b.texture,d.mapping)}else return null}}return d}function a(d){if(d&&d.isTexture){const g=d.mapping,x=g===ys||g===Ts,b=g===Hn||g===ci;if(x||b){let m=t.get(d);const h=m!==void 0?m.texture.pmremVersion:0;if(d.isRenderTargetTexture&&d.pmremVersion!==h)return n===null&&(n=new Za(i)),m=x?n.fromEquirectangular(d,m):n.fromCubemap(d,m),m.texture.pmremVersion=d.pmremVersion,t.set(d,m),m.texture;if(m!==void 0)return m.texture;{const A=d.image;return x&&A&&A.height>0||b&&A&&l(A)?(n===null&&(n=new Za(i)),m=x?n.fromEquirectangular(d):n.fromCubemap(d),m.texture.pmremVersion=d.pmremVersion,t.set(d,m),d.addEventListener("dispose",u),m.texture):null}}}return d}function o(d,g){return g===ys?d.mapping=Hn:g===Ts&&(d.mapping=ci),d}function l(d){let g=0;const x=6;for(let b=0;b<x;b++)d[b]!==void 0&&g++;return g===x}function c(d){const g=d.target;g.removeEventListener("dispose",c);const x=e.get(g);x!==void 0&&(e.delete(g),x.dispose())}function u(d){const g=d.target;g.removeEventListener("dispose",u);const x=t.get(g);x!==void 0&&(t.delete(g),x.dispose())}function p(){e=new WeakMap,t=new WeakMap,n!==null&&(n.dispose(),n=null)}return{get:s,dispose:p}}function mf(i){const e={};function t(n){if(e[n]!==void 0)return e[n];const s=i.getExtension(n);return e[n]=s,s}return{has:function(n){return t(n)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(n){const s=t(n);return s===null&&oi("WebGLRenderer: "+n+" extension not supported."),s}}}function gf(i,e,t,n){const s={},r=new WeakMap;function a(p){const d=p.target;d.index!==null&&e.remove(d.index);for(const x in d.attributes)e.remove(d.attributes[x]);d.removeEventListener("dispose",a),delete s[d.id];const g=r.get(d);g&&(e.remove(g),r.delete(d)),n.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,t.memory.geometries--}function o(p,d){return s[d.id]===!0||(d.addEventListener("dispose",a),s[d.id]=!0,t.memory.geometries++),d}function l(p){const d=p.attributes;for(const g in d)e.update(d[g],i.ARRAY_BUFFER)}function c(p){const d=[],g=p.index,x=p.attributes.position;let b=0;if(x===void 0)return;if(g!==null){const A=g.array;b=g.version;for(let P=0,M=A.length;P<M;P+=3){const T=A[P+0],E=A[P+1],C=A[P+2];d.push(T,E,E,C,C,T)}}else{const A=x.array;b=x.version;for(let P=0,M=A.length/3-1;P<M;P+=3){const T=P+0,E=P+1,C=P+2;d.push(T,E,E,C,C,T)}}const m=new(x.count>=65535?Yo:qo)(d,1);m.version=b;const h=r.get(p);h&&e.remove(h),r.set(p,m)}function u(p){const d=r.get(p);if(d){const g=p.index;g!==null&&d.version<g.version&&c(p)}else c(p);return r.get(p)}return{get:o,update:l,getWireframeAttribute:u}}function xf(i,e,t){let n;function s(p){n=p}let r,a;function o(p){r=p.type,a=p.bytesPerElement}function l(p,d){i.drawElements(n,d,r,p*a),t.update(d,n,1)}function c(p,d,g){g!==0&&(i.drawElementsInstanced(n,d,r,p*a,g),t.update(d,n,g))}function u(p,d,g){if(g===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,d,0,r,p,0,g);let b=0;for(let m=0;m<g;m++)b+=d[m];t.update(b,n,1)}this.setMode=s,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=u}function _f(i){const e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,a,o){switch(t.calls++,a){case i.TRIANGLES:t.triangles+=o*(r/3);break;case i.LINES:t.lines+=o*(r/2);break;case i.LINE_STRIP:t.lines+=o*(r-1);break;case i.LINE_LOOP:t.lines+=o*r;break;case i.POINTS:t.points+=o*r;break;default:qe("WebGLInfo: Unknown draw mode:",a);break}}function s(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:s,update:n}}function vf(i,e,t){const n=new WeakMap,s=new dt;function r(a,o,l){const c=a.morphTargetInfluences,u=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,p=u!==void 0?u.length:0;let d=n.get(o);if(d===void 0||d.count!==p){let w=function(){C.dispose(),n.delete(o),o.removeEventListener("dispose",w)};d!==void 0&&d.texture.dispose();const g=o.morphAttributes.position!==void 0,x=o.morphAttributes.normal!==void 0,b=o.morphAttributes.color!==void 0,m=o.morphAttributes.position||[],h=o.morphAttributes.normal||[],A=o.morphAttributes.color||[];let P=0;g===!0&&(P=1),x===!0&&(P=2),b===!0&&(P=3);let M=o.attributes.position.count*P,T=1;M>e.maxTextureSize&&(T=Math.ceil(M/e.maxTextureSize),M=e.maxTextureSize);const E=new Float32Array(M*T*4*p),C=new Vo(E,M,T,p);C.type=tn,C.needsUpdate=!0;const v=P*4;for(let D=0;D<p;D++){const U=m[D],k=h[D],W=A[D],I=M*T*4*D;for(let O=0;O<U.count;O++){const j=O*v;g===!0&&(s.fromBufferAttribute(U,O),E[I+j+0]=s.x,E[I+j+1]=s.y,E[I+j+2]=s.z,E[I+j+3]=0),x===!0&&(s.fromBufferAttribute(k,O),E[I+j+4]=s.x,E[I+j+5]=s.y,E[I+j+6]=s.z,E[I+j+7]=0),b===!0&&(s.fromBufferAttribute(W,O),E[I+j+8]=s.x,E[I+j+9]=s.y,E[I+j+10]=s.z,E[I+j+11]=W.itemSize===4?s.w:1)}}d={count:p,texture:C,size:new Ve(M,T)},n.set(o,d),o.addEventListener("dispose",w)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)l.getUniforms().setValue(i,"morphTexture",a.morphTexture,t);else{let g=0;for(let b=0;b<c.length;b++)g+=c[b];const x=o.morphTargetsRelative?1:1-g;l.getUniforms().setValue(i,"morphTargetBaseInfluence",x),l.getUniforms().setValue(i,"morphTargetInfluences",c)}l.getUniforms().setValue(i,"morphTargetsTexture",d.texture,t),l.getUniforms().setValue(i,"morphTargetsTextureSize",d.size)}return{update:r}}function Sf(i,e,t,n,s){let r=new WeakMap;function a(c){const u=s.render.frame,p=c.geometry,d=e.get(c,p);if(r.get(d)!==u&&(e.update(d),r.set(d,u)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),r.get(c)!==u&&(t.update(c.instanceMatrix,i.ARRAY_BUFFER),c.instanceColor!==null&&t.update(c.instanceColor,i.ARRAY_BUFFER),r.set(c,u))),c.isSkinnedMesh){const g=c.skeleton;r.get(g)!==u&&(g.update(),r.set(g,u))}return d}function o(){r=new WeakMap}function l(c){const u=c.target;u.removeEventListener("dispose",l),n.releaseStatesOfObject(u),t.remove(u.instanceMatrix),u.instanceColor!==null&&t.remove(u.instanceColor)}return{update:a,dispose:o}}const Mf={[Ao]:"LINEAR_TONE_MAPPING",[Co]:"REINHARD_TONE_MAPPING",[Ro]:"CINEON_TONE_MAPPING",[Po]:"ACES_FILMIC_TONE_MAPPING",[Lo]:"AGX_TONE_MAPPING",[Do]:"NEUTRAL_TONE_MAPPING",[No]:"CUSTOM_TONE_MAPPING"};function bf(i,e,t,n,s,r){const a=new Yt(e,t,{type:i,depthBuffer:s,stencilBuffer:r,samples:n?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1});let o=null,l=null;const c=new Kt;c.setAttribute("position",new _n([-1,3,0,-1,-1,0,3,-1,0],3)),c.setAttribute("uv",new _n([0,2,0,0,2,0],2));const u=new ld({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),p=new on(c,u),d=new nl(-1,1,1,-1,0,1);let g=null,x=null,b=!1,m,h=null,A=[],P=!1;this.setSize=function(M,T){a.setSize(M,T),o!==null&&o.setSize(M,T),l!==null&&l.setSize(M,T);for(let E=0;E<A.length;E++){const C=A[E];C.setSize&&C.setSize(M,T)}},this.setEffects=function(M){A=M,P=A.length>0&&A[0].isRenderPass===!0;const T=a.width,E=a.height;A.length>0&&o===null&&(o=new Yt(T,E,{type:an,depthBuffer:!1,stencilBuffer:!1}),l=new Yt(T,E,{type:an,depthBuffer:!1,stencilBuffer:!1}));for(let C=0;C<A.length;C++){const v=A[C];v.setSize&&v.setSize(T,E)}},this.begin=function(M,T){if(b||M.toneMapping===sn&&A.length===0)return!1;if(h=T,T!==null){const E=T.width,C=T.height;(a.width!==E||a.height!==C)&&this.setSize(E,C)}return P===!1&&M.setRenderTarget(a),m=M.toneMapping,M.toneMapping=sn,!0},this.hasRenderPass=function(){return P},this.end=function(M,T){M.toneMapping=m,b=!0;let E=a,C=o;for(let v=0;v<A.length;v++){const w=A[v];w.enabled!==!1&&(w.render(M,C,E,T),w.needsSwap!==!1&&(E=C,C=C===o?l:o))}if(g!==M.outputColorSpace||x!==M.toneMapping){g=M.outputColorSpace,x=M.toneMapping,u.defines={},ke.getTransfer(g)===$e&&(u.defines.SRGB_TRANSFER="");const v=Mf[x];v&&(u.defines[v]=""),u.needsUpdate=!0}u.uniforms.tDiffuse.value=E.texture,M.setRenderTarget(h),M.render(p,d),h=null,b=!1},this.isCompositing=function(){return b},this.dispose=function(){a.dispose(),o!==null&&o.dispose(),l!==null&&l.dispose(),c.dispose(),u.dispose()}}const ol=new Ct,qr=new Ci(1,1),ll=new Vo,cl=new Bc,dl=new $o,eo=[],to=[],no=new Float32Array(16),io=new Float32Array(9),so=new Float32Array(4);function fi(i,e,t){const n=i[0];if(n<=0||n>0)return i;const s=e*t;let r=eo[s];if(r===void 0&&(r=new Float32Array(s),eo[s]=r),e!==0){n.toArray(r,0);for(let a=1,o=0;a!==e;++a)o+=t,i[a].toArray(r,o)}return r}function gt(i,e){if(i.length!==e.length)return!1;for(let t=0,n=i.length;t<n;t++)if(i[t]!==e[t])return!1;return!0}function xt(i,e){for(let t=0,n=e.length;t<n;t++)i[t]=e[t]}function Ms(i,e){let t=to[e];t===void 0&&(t=new Int32Array(e),to[e]=t);for(let n=0;n!==e;++n)t[n]=i.allocateTextureUnit();return t}function Ef(i,e){const t=this.cache;t[0]!==e&&(i.uniform1f(this.addr,e),t[0]=e)}function yf(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(gt(t,e))return;i.uniform2fv(this.addr,e),xt(t,e)}}function Tf(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(i.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(gt(t,e))return;i.uniform3fv(this.addr,e),xt(t,e)}}function wf(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(gt(t,e))return;i.uniform4fv(this.addr,e),xt(t,e)}}function Af(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(gt(t,e))return;i.uniformMatrix2fv(this.addr,!1,e),xt(t,e)}else{if(gt(t,n))return;so.set(n),i.uniformMatrix2fv(this.addr,!1,so),xt(t,n)}}function Cf(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(gt(t,e))return;i.uniformMatrix3fv(this.addr,!1,e),xt(t,e)}else{if(gt(t,n))return;io.set(n),i.uniformMatrix3fv(this.addr,!1,io),xt(t,n)}}function Rf(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(gt(t,e))return;i.uniformMatrix4fv(this.addr,!1,e),xt(t,e)}else{if(gt(t,n))return;no.set(n),i.uniformMatrix4fv(this.addr,!1,no),xt(t,n)}}function Pf(i,e){const t=this.cache;t[0]!==e&&(i.uniform1i(this.addr,e),t[0]=e)}function Nf(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(gt(t,e))return;i.uniform2iv(this.addr,e),xt(t,e)}}function Lf(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(gt(t,e))return;i.uniform3iv(this.addr,e),xt(t,e)}}function Df(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(gt(t,e))return;i.uniform4iv(this.addr,e),xt(t,e)}}function If(i,e){const t=this.cache;t[0]!==e&&(i.uniform1ui(this.addr,e),t[0]=e)}function Uf(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(gt(t,e))return;i.uniform2uiv(this.addr,e),xt(t,e)}}function Ff(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(gt(t,e))return;i.uniform3uiv(this.addr,e),xt(t,e)}}function Of(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(gt(t,e))return;i.uniform4uiv(this.addr,e),xt(t,e)}}function Bf(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);let r;this.type===i.SAMPLER_2D_SHADOW?(qr.compareFunction=t.isReversedDepthBuffer()?sa:ia,r=qr):r=ol,t.setTexture2D(e||r,s)}function zf(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTexture3D(e||cl,s)}function kf(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTextureCube(e||dl,s)}function Hf(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTexture2DArray(e||ll,s)}function Gf(i){switch(i){case 5126:return Ef;case 35664:return yf;case 35665:return Tf;case 35666:return wf;case 35674:return Af;case 35675:return Cf;case 35676:return Rf;case 5124:case 35670:return Pf;case 35667:case 35671:return Nf;case 35668:case 35672:return Lf;case 35669:case 35673:return Df;case 5125:return If;case 36294:return Uf;case 36295:return Ff;case 36296:return Of;case 35678:case 36198:case 36298:case 36306:case 35682:return Bf;case 35679:case 36299:case 36307:return zf;case 35680:case 36300:case 36308:case 36293:return kf;case 36289:case 36303:case 36311:case 36292:return Hf}}function Vf(i,e){i.uniform1fv(this.addr,e)}function Wf(i,e){const t=fi(e,this.size,2);i.uniform2fv(this.addr,t)}function Xf(i,e){const t=fi(e,this.size,3);i.uniform3fv(this.addr,t)}function qf(i,e){const t=fi(e,this.size,4);i.uniform4fv(this.addr,t)}function Yf(i,e){const t=fi(e,this.size,4);i.uniformMatrix2fv(this.addr,!1,t)}function jf(i,e){const t=fi(e,this.size,9);i.uniformMatrix3fv(this.addr,!1,t)}function Kf(i,e){const t=fi(e,this.size,16);i.uniformMatrix4fv(this.addr,!1,t)}function Zf(i,e){i.uniform1iv(this.addr,e)}function $f(i,e){i.uniform2iv(this.addr,e)}function Jf(i,e){i.uniform3iv(this.addr,e)}function Qf(i,e){i.uniform4iv(this.addr,e)}function ep(i,e){i.uniform1uiv(this.addr,e)}function tp(i,e){i.uniform2uiv(this.addr,e)}function np(i,e){i.uniform3uiv(this.addr,e)}function ip(i,e){i.uniform4uiv(this.addr,e)}function sp(i,e,t){const n=this.cache,s=e.length,r=Ms(t,s);gt(n,r)||(i.uniform1iv(this.addr,r),xt(n,r));let a;this.type===i.SAMPLER_2D_SHADOW?a=qr:a=ol;for(let o=0;o!==s;++o)t.setTexture2D(e[o]||a,r[o])}function rp(i,e,t){const n=this.cache,s=e.length,r=Ms(t,s);gt(n,r)||(i.uniform1iv(this.addr,r),xt(n,r));for(let a=0;a!==s;++a)t.setTexture3D(e[a]||cl,r[a])}function ap(i,e,t){const n=this.cache,s=e.length,r=Ms(t,s);gt(n,r)||(i.uniform1iv(this.addr,r),xt(n,r));for(let a=0;a!==s;++a)t.setTextureCube(e[a]||dl,r[a])}function op(i,e,t){const n=this.cache,s=e.length,r=Ms(t,s);gt(n,r)||(i.uniform1iv(this.addr,r),xt(n,r));for(let a=0;a!==s;++a)t.setTexture2DArray(e[a]||ll,r[a])}function lp(i){switch(i){case 5126:return Vf;case 35664:return Wf;case 35665:return Xf;case 35666:return qf;case 35674:return Yf;case 35675:return jf;case 35676:return Kf;case 5124:case 35670:return Zf;case 35667:case 35671:return $f;case 35668:case 35672:return Jf;case 35669:case 35673:return Qf;case 5125:return ep;case 36294:return tp;case 36295:return np;case 36296:return ip;case 35678:case 36198:case 36298:case 36306:case 35682:return sp;case 35679:case 36299:case 36307:return rp;case 35680:case 36300:case 36308:case 36293:return ap;case 36289:case 36303:case 36311:case 36292:return op}}class cp{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=Gf(t.type)}}class dp{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=lp(t.type)}}class hp{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){const s=this.seq;for(let r=0,a=s.length;r!==a;++r){const o=s[r];o.setValue(e,t[o.id],n)}}}const tr=/(\w+)(\])?(\[|\.)?/g;function ro(i,e){i.seq.push(e),i.map[e.id]=e}function up(i,e,t){const n=i.name,s=n.length;for(tr.lastIndex=0;;){const r=tr.exec(n),a=tr.lastIndex;let o=r[1];const l=r[2]==="]",c=r[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===s){ro(t,c===void 0?new cp(o,i,e):new dp(o,i,e));break}else{let p=t.map[o];p===void 0&&(p=new hp(o),ro(t,p)),t=p}}}class us{constructor(e,t){this.seq=[],this.map={};const n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let a=0;a<n;++a){const o=e.getActiveUniform(t,a),l=e.getUniformLocation(t,o.name);up(o,l,this)}const s=[],r=[];for(const a of this.seq)a.type===e.SAMPLER_2D_SHADOW||a.type===e.SAMPLER_CUBE_SHADOW||a.type===e.SAMPLER_2D_ARRAY_SHADOW?s.push(a):r.push(a);s.length>0&&(this.seq=s.concat(r))}setValue(e,t,n,s){const r=this.map[t];r!==void 0&&r.setValue(e,n,s)}setOptional(e,t,n){const s=t[n];s!==void 0&&this.setValue(e,n,s)}static upload(e,t,n,s){for(let r=0,a=t.length;r!==a;++r){const o=t[r],l=n[o.id];l.needsUpdate!==!1&&o.setValue(e,l.value,s)}}static seqWithValue(e,t){const n=[];for(let s=0,r=e.length;s!==r;++s){const a=e[s];a.id in t&&n.push(a)}return n}}function ao(i,e,t){const n=i.createShader(e);return i.shaderSource(n,t),i.compileShader(n),n}const fp=37297;let pp=0;function mp(i,e){const t=i.split(`
`),n=[],s=Math.max(e-6,0),r=Math.min(e+6,t.length);for(let a=s;a<r;a++){const o=a+1;n.push(`${o===e?">":" "} ${o}: ${t[a]}`)}return n.join(`
`)}const oo=new Ne;function gp(i){ke._getMatrix(oo,ke.workingColorSpace,i);const e=`mat3( ${oo.elements.map(t=>t.toFixed(4))} )`;switch(ke.getTransfer(i)){case gs:return[e,"LinearTransferOETF"];case $e:return[e,"sRGBTransferOETF"];default:return Re("WebGLProgram: Unsupported color space: ",i),[e,"LinearTransferOETF"]}}function lo(i,e,t){const n=i.getShaderParameter(e,i.COMPILE_STATUS),r=(i.getShaderInfoLog(e)||"").trim();if(n&&r==="")return"";const a=/ERROR: 0:(\d+)/.exec(r);if(a){const o=parseInt(a[1]);return t.toUpperCase()+`

`+r+`

`+mp(i.getShaderSource(e),o)}else return r}function xp(i,e){const t=gp(e);return[`vec4 ${i}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}const _p={[Ao]:"Linear",[Co]:"Reinhard",[Ro]:"Cineon",[Po]:"ACESFilmic",[Lo]:"AgX",[Do]:"Neutral",[No]:"Custom"};function vp(i,e){const t=_p[e];return t===void 0?(Re("WebGLProgram: Unsupported toneMapping:",e),"vec3 "+i+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+i+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}const as=new G;function Sp(){ke.getLuminanceCoefficients(as);const i=as.x.toFixed(4),e=as.y.toFixed(4),t=as.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function Mp(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(bi).join(`
`)}function bp(i){const e=[];for(const t in i){const n=i[t];n!==!1&&e.push("#define "+t+" "+n)}return e.join(`
`)}function Ep(i,e){const t={},n=i.getProgramParameter(e,i.ACTIVE_ATTRIBUTES);for(let s=0;s<n;s++){const r=i.getActiveAttrib(e,s),a=r.name;let o=1;r.type===i.FLOAT_MAT2&&(o=2),r.type===i.FLOAT_MAT3&&(o=3),r.type===i.FLOAT_MAT4&&(o=4),t[a]={type:r.type,location:i.getAttribLocation(e,a),locationSize:o}}return t}function bi(i){return i!==""}function co(i,e){const t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return i.replace(/NUM_SUN_LIGHTS/g,e.numSunLights).replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,e.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function ho(i,e){return i.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}const yp=/^[ \t]*#include +<([\w\d./]+)>/gm;function Yr(i){return i.replace(yp,wp)}const Tp=new Map;function wp(i,e){let t=Ie[e];if(t===void 0){const n=Tp.get(e);if(n!==void 0)t=Ie[n],Re('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,n);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+e+">")}return Yr(t)}const Ap=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function uo(i){return i.replace(Ap,Cp)}function Cp(i,e,t,n){let s="";for(let r=parseInt(e);r<parseInt(t);r++)s+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function fo(i){let e=`precision ${i.precision} float;
	precision ${i.precision} int;
	precision ${i.precision} sampler2D;
	precision ${i.precision} samplerCube;
	precision ${i.precision} sampler3D;
	precision ${i.precision} sampler2DArray;
	precision ${i.precision} sampler2DShadow;
	precision ${i.precision} samplerCubeShadow;
	precision ${i.precision} sampler2DArrayShadow;
	precision ${i.precision} isampler2D;
	precision ${i.precision} isampler3D;
	precision ${i.precision} isamplerCube;
	precision ${i.precision} isampler2DArray;
	precision ${i.precision} usampler2D;
	precision ${i.precision} usampler3D;
	precision ${i.precision} usamplerCube;
	precision ${i.precision} usampler2DArray;
	`;return i.precision==="highp"?e+=`
#define HIGH_PRECISION`:i.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:i.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}const Rp={[os]:"SHADOWMAP_TYPE_PCF",[Mi]:"SHADOWMAP_TYPE_VSM"};function Pp(i){return Rp[i.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}const Np={[Hn]:"ENVMAP_TYPE_CUBE",[ci]:"ENVMAP_TYPE_CUBE",[_s]:"ENVMAP_TYPE_CUBE_UV"};function Lp(i){return i.envMap===!1?"ENVMAP_TYPE_CUBE":Np[i.envMapMode]||"ENVMAP_TYPE_CUBE"}const Dp={[ci]:"ENVMAP_MODE_REFRACTION"};function Ip(i){return i.envMap===!1?"ENVMAP_MODE_REFLECTION":Dp[i.envMapMode]||"ENVMAP_MODE_REFLECTION"}const Up={[wo]:"ENVMAP_BLENDING_MULTIPLY",[mc]:"ENVMAP_BLENDING_MIX",[gc]:"ENVMAP_BLENDING_ADD"};function Fp(i){return i.envMap===!1?"ENVMAP_BLENDING_NONE":Up[i.combine]||"ENVMAP_BLENDING_NONE"}function Op(i){const e=i.envMapCubeUVHeight;if(e===null)return null;const t=Math.log2(e)-2,n=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:n,maxMip:t}}function Bp(i,e,t,n){const s=i.getContext(),r=t.defines;let a=t.vertexShader,o=t.fragmentShader;const l=Pp(t),c=Lp(t),u=Ip(t),p=Fp(t),d=Op(t),g=Mp(t),x=bp(r),b=s.createProgram();let m,h,A=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(m=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,x].filter(bi).join(`
`),m.length>0&&(m+=`
`),h=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,x].filter(bi).join(`
`),h.length>0&&(h+=`
`)):(m=[fo(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,x,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+u:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexNormals?"#define HAS_NORMAL":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(bi).join(`
`),h=[fo(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,x,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+u:"",t.envMap?"#define "+p:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.retroreflection?"#define USE_RETROREFLECTION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas||t.batchingColor?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==sn?"#define TONE_MAPPING":"",t.toneMapping!==sn?Ie.tonemapping_pars_fragment:"",t.toneMapping!==sn?vp("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",Ie.colorspace_pars_fragment,xp("linearToOutputTexel",t.outputColorSpace),Sp(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(bi).join(`
`)),a=Yr(a),a=co(a,t),a=ho(a,t),o=Yr(o),o=co(o,t),o=ho(o,t),a=uo(a),o=uo(o),t.isRawShaderMaterial!==!0&&(A=`#version 300 es
`,m=[g,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,h=["#define varying in",t.glslVersion===Ea?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===Ea?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+h);const P=A+m+a,M=A+h+o,T=ao(s,s.VERTEX_SHADER,P),E=ao(s,s.FRAGMENT_SHADER,M);s.attachShader(b,T),s.attachShader(b,E),t.index0AttributeName!==void 0?s.bindAttribLocation(b,0,t.index0AttributeName):t.hasPositionAttribute===!0&&s.bindAttribLocation(b,0,"position"),s.linkProgram(b);function C(U){if(i.debug.checkShaderErrors){const k=s.getProgramInfoLog(b)||"",W=s.getShaderInfoLog(T)||"",I=s.getShaderInfoLog(E)||"",O=k.trim(),j=W.trim(),X=I.trim();let ne=!0,q=!0;if(s.getProgramParameter(b,s.LINK_STATUS)===!1)if(ne=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(s,b,T,E);else{const Q=lo(s,T,"vertex"),te=lo(s,E,"fragment");qe("WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(b,s.VALIDATE_STATUS)+`

Material Name: `+U.name+`
Material Type: `+U.type+`

Program Info Log: `+O+`
`+Q+`
`+te)}else O!==""?Re("WebGLProgram: Program Info Log:",O):(j===""||X==="")&&(q=!1);q&&(U.diagnostics={runnable:ne,programLog:O,vertexShader:{log:j,prefix:m},fragmentShader:{log:X,prefix:h}})}s.deleteShader(T),s.deleteShader(E),v=new us(s,b),w=Ep(s,b)}let v;this.getUniforms=function(){return v===void 0&&C(this),v};let w;this.getAttributes=function(){return w===void 0&&C(this),w};let D=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return D===!1&&(D=s.getProgramParameter(b,fp)),D},this.destroy=function(){n.releaseStatesOfProgram(this),s.deleteProgram(b),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=pp++,this.cacheKey=e,this.usedTimes=1,this.program=b,this.vertexShader=T,this.fragmentShader=E,this}let zp=0;class kp{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,n){const s=this._getShaderCacheForMaterial(e);return s.has(t)===!1&&(s.add(t),t.usedTimes++),s.has(n)===!1&&(s.add(n),n.usedTimes++),this}remove(e){const t=this.materialCache.get(e);for(const n of t)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){const t=this.materialCache;let n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){const t=this.shaderCache;let n=t.get(e);return n===void 0&&(n=new Hp(e),t.set(e,n)),n}}class Hp{constructor(e){this.id=zp++,this.code=e,this.usedTimes=0}}function Gp(i){return i===Gn||i===fs||i===ps}function Vp(i,e,t,n,s,r){const a=new Wo,o=new kp,l=new Set,c=[],u=new Map,p=n.logarithmicDepthBuffer;let d=n.precision;const g={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function x(v){return l.add(v),v===0?"uv":`uv${v}`}function b(v,w,D,U,k,W){const I=U.fog,O=k.geometry,j=v.isMeshStandardMaterial||v.isMeshLambertMaterial||v.isMeshPhongMaterial?U.environment:null,X=v.isMeshStandardMaterial||v.isMeshLambertMaterial&&!v.envMap||v.isMeshPhongMaterial&&!v.envMap,ne=e.get(v.envMap||j,X),q=ne&&ne.mapping===_s?ne.image.height:null,Q=g[v.type];v.precision!==null&&(d=n.getMaxPrecision(v.precision),d!==v.precision&&Re("WebGLProgram.getParameters:",v.precision,"not supported, using",d,"instead."));const te=O.morphAttributes.position||O.morphAttributes.normal||O.morphAttributes.color,Ae=te!==void 0?te.length:0;let Te=0;O.morphAttributes.position!==void 0&&(Te=1),O.morphAttributes.normal!==void 0&&(Te=2),O.morphAttributes.color!==void 0&&(Te=3);let et,Ge,Ye,K;if(Q){const nt=en[Q];et=nt.vertexShader,Ge=nt.fragmentShader}else{et=v.vertexShader,Ge=v.fragmentShader;const nt=o.getVertexShaderStage(v),je=o.getFragmentShaderStage(v);o.update(v,nt,je),Ye=nt.id,K=je.id}const ee=i.getRenderTarget(),_e=i.state.buffers.depth.getReversed(),Pe=k.isInstancedMesh===!0,ge=k.isBatchedMesh===!0,Ue=!!v.map,mt=!!v.matcap,Oe=!!ne,Xe=!!v.aoMap,tt=!!v.lightMap,ze=!!v.bumpMap&&v.wireframe===!1,rt=!!v.normalMap,_t=!!v.displacementMap,Pt=!!v.emissiveMap,lt=!!v.metalnessMap,ut=!!v.roughnessMap,L=v.anisotropy>0,Mt=v.clearcoat>0,Ze=v.dispersion>0,y=v.retroreflectivity>0,f=v.iridescence>0,F=v.sheen>0,H=v.transmission>0,Y=L&&!!v.anisotropyMap,se=Mt&&!!v.clearcoatMap,re=Mt&&!!v.clearcoatNormalMap,Z=Mt&&!!v.clearcoatRoughnessMap,J=f&&!!v.iridescenceMap,ae=f&&!!v.iridescenceThicknessMap,Ee=F&&!!v.sheenColorMap,de=F&&!!v.sheenRoughnessMap,oe=!!v.specularMap,ye=!!v.specularColorMap,Ce=!!v.specularIntensityMap,Le=H&&!!v.transmissionMap,N=H&&!!v.thicknessMap,le=!!v.gradientMap,$=!!v.alphaMap,ce=v.alphaTest>0,pe=!!v.alphaHash,ie=!!v.extensions;let we=sn;v.toneMapped&&(ee===null||ee.isXRRenderTarget===!0)&&(we=i.toneMapping);const Me={shaderID:Q,shaderType:v.type,shaderName:v.name,vertexShader:et,fragmentShader:Ge,defines:v.defines,customVertexShaderID:Ye,customFragmentShaderID:K,isRawShaderMaterial:v.isRawShaderMaterial===!0,glslVersion:v.glslVersion,precision:d,batching:ge,batchingColor:ge&&k._colorsTexture!==null,instancing:Pe,instancingColor:Pe&&k.instanceColor!==null,instancingMorph:Pe&&k.morphTexture!==null,outputColorSpace:ee===null?i.outputColorSpace:ee.isXRRenderTarget===!0?ee.texture.colorSpace:ke.workingColorSpace,alphaToCoverage:!!v.alphaToCoverage,map:Ue,matcap:mt,envMap:Oe,envMapMode:Oe&&ne.mapping,envMapCubeUVHeight:q,aoMap:Xe,lightMap:tt,bumpMap:ze,normalMap:rt,displacementMap:_t,emissiveMap:Pt,normalMapObjectSpace:rt&&v.normalMapType===vc,normalMapTangentSpace:rt&&v.normalMapType===Vr,packedNormalMap:rt&&v.normalMapType===Vr&&Gp(v.normalMap.format),metalnessMap:lt,roughnessMap:ut,anisotropy:L,anisotropyMap:Y,clearcoat:Mt,clearcoatMap:se,clearcoatNormalMap:re,clearcoatRoughnessMap:Z,dispersion:Ze,retroreflection:y,iridescence:f,iridescenceMap:J,iridescenceThicknessMap:ae,sheen:F,sheenColorMap:Ee,sheenRoughnessMap:de,specularMap:oe,specularColorMap:ye,specularIntensityMap:Ce,transmission:H,transmissionMap:Le,thicknessMap:N,gradientMap:le,opaque:v.transparent===!1&&v.blending===Ei&&v.alphaToCoverage===!1,alphaMap:$,alphaTest:ce,alphaHash:pe,combine:v.combine,mapUv:Ue&&x(v.map.channel),aoMapUv:Xe&&x(v.aoMap.channel),lightMapUv:tt&&x(v.lightMap.channel),bumpMapUv:ze&&x(v.bumpMap.channel),normalMapUv:rt&&x(v.normalMap.channel),displacementMapUv:_t&&x(v.displacementMap.channel),emissiveMapUv:Pt&&x(v.emissiveMap.channel),metalnessMapUv:lt&&x(v.metalnessMap.channel),roughnessMapUv:ut&&x(v.roughnessMap.channel),anisotropyMapUv:Y&&x(v.anisotropyMap.channel),clearcoatMapUv:se&&x(v.clearcoatMap.channel),clearcoatNormalMapUv:re&&x(v.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:Z&&x(v.clearcoatRoughnessMap.channel),iridescenceMapUv:J&&x(v.iridescenceMap.channel),iridescenceThicknessMapUv:ae&&x(v.iridescenceThicknessMap.channel),sheenColorMapUv:Ee&&x(v.sheenColorMap.channel),sheenRoughnessMapUv:de&&x(v.sheenRoughnessMap.channel),specularMapUv:oe&&x(v.specularMap.channel),specularColorMapUv:ye&&x(v.specularColorMap.channel),specularIntensityMapUv:Ce&&x(v.specularIntensityMap.channel),transmissionMapUv:Le&&x(v.transmissionMap.channel),thicknessMapUv:N&&x(v.thicknessMap.channel),alphaMapUv:$&&x(v.alphaMap.channel),vertexTangents:!!O.attributes.tangent&&(rt||L),vertexNormals:!!O.attributes.normal,vertexColors:v.vertexColors,vertexAlphas:v.vertexColors===!0&&!!O.attributes.color&&O.attributes.color.itemSize===4,pointsUvs:k.isPoints===!0&&!!O.attributes.uv&&(Ue||$),fog:!!I,useFog:v.fog===!0,fogExp2:!!I&&I.isFogExp2,flatShading:v.wireframe===!1&&(v.flatShading===!0||O.attributes.normal===void 0&&rt===!1&&(v.isMeshLambertMaterial||v.isMeshPhongMaterial||v.isMeshStandardMaterial||v.isMeshPhysicalMaterial)),sizeAttenuation:v.sizeAttenuation===!0,logarithmicDepthBuffer:p,reversedDepthBuffer:_e,skinning:k.isSkinnedMesh===!0,hasPositionAttribute:O.attributes.position!==void 0,morphTargets:O.morphAttributes.position!==void 0,morphNormals:O.morphAttributes.normal!==void 0,morphColors:O.morphAttributes.color!==void 0,morphTargetsCount:Ae,morphTextureStride:Te,numSunLights:w.sun.length,numDirLights:w.directional.length,numPointLights:w.point.length,numSpotLights:w.spot.length,numSpotLightMaps:w.spotLightMap.length,numRectAreaLights:w.rectArea.length,numHemiLights:w.hemi.length,numSunLightShadows:w.sunShadowMap.length,numDirLightShadows:w.directionalShadowMap.length,numPointLightShadows:w.pointShadowMap.length,numSpotLightShadows:w.spotShadowMap.length,numSpotLightShadowsWithMaps:w.numSpotLightShadowsWithMaps,numLightProbes:w.numLightProbes,numLightProbeGrids:W.length,numClippingPlanes:r.numPlanes,numClipIntersection:r.numIntersection,dithering:v.dithering,shadowMapEnabled:i.shadowMap.enabled&&D.length>0,shadowMapType:i.shadowMap.type,toneMapping:we,decodeVideoTexture:Ue&&v.map.isVideoTexture===!0&&ke.getTransfer(v.map.colorSpace)===$e,decodeVideoTextureEmissive:Pt&&v.emissiveMap.isVideoTexture===!0&&ke.getTransfer(v.emissiveMap.colorSpace)===$e,premultipliedAlpha:v.premultipliedAlpha,doubleSided:v.side===pn,flipSided:v.side===Lt,useDepthPacking:v.depthPacking>=0,depthPacking:v.depthPacking||0,index0AttributeName:v.index0AttributeName,extensionClipCullDistance:ie&&v.extensions.clipCullDistance===!0&&t.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(ie&&v.extensions.multiDraw===!0||ge)&&t.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:t.has("KHR_parallel_shader_compile"),customProgramCacheKey:v.customProgramCacheKey()};return Me.vertexUv1s=l.has(1),Me.vertexUv2s=l.has(2),Me.vertexUv3s=l.has(3),l.clear(),Me}function m(v){const w=[];if(v.shaderID?w.push(v.shaderID):(w.push(v.customVertexShaderID),w.push(v.customFragmentShaderID)),v.defines!==void 0)for(const D in v.defines)w.push(D),w.push(v.defines[D]);return v.isRawShaderMaterial===!1&&(h(w,v),A(w,v),w.push(i.outputColorSpace)),w.push(v.customProgramCacheKey),w.join()}function h(v,w){v.push(w.precision),v.push(w.outputColorSpace),v.push(w.envMapMode),v.push(w.envMapCubeUVHeight),v.push(w.mapUv),v.push(w.alphaMapUv),v.push(w.lightMapUv),v.push(w.aoMapUv),v.push(w.bumpMapUv),v.push(w.normalMapUv),v.push(w.displacementMapUv),v.push(w.emissiveMapUv),v.push(w.metalnessMapUv),v.push(w.roughnessMapUv),v.push(w.anisotropyMapUv),v.push(w.clearcoatMapUv),v.push(w.clearcoatNormalMapUv),v.push(w.clearcoatRoughnessMapUv),v.push(w.iridescenceMapUv),v.push(w.iridescenceThicknessMapUv),v.push(w.sheenColorMapUv),v.push(w.sheenRoughnessMapUv),v.push(w.specularMapUv),v.push(w.specularColorMapUv),v.push(w.specularIntensityMapUv),v.push(w.transmissionMapUv),v.push(w.thicknessMapUv),v.push(w.combine),v.push(w.fogExp2),v.push(w.sizeAttenuation),v.push(w.morphTargetsCount),v.push(w.morphAttributeCount),v.push(w.numSunLights),v.push(w.numDirLights),v.push(w.numPointLights),v.push(w.numSpotLights),v.push(w.numSpotLightMaps),v.push(w.numHemiLights),v.push(w.numRectAreaLights),v.push(w.numSunLightShadows),v.push(w.numDirLightShadows),v.push(w.numPointLightShadows),v.push(w.numSpotLightShadows),v.push(w.numSpotLightShadowsWithMaps),v.push(w.numLightProbes),v.push(w.shadowMapType),v.push(w.toneMapping),v.push(w.numClippingPlanes),v.push(w.numClipIntersection),v.push(w.depthPacking)}function A(v,w){a.disableAll(),w.instancing&&a.enable(0),w.instancingColor&&a.enable(1),w.instancingMorph&&a.enable(2),w.matcap&&a.enable(3),w.envMap&&a.enable(4),w.normalMapObjectSpace&&a.enable(5),w.normalMapTangentSpace&&a.enable(6),w.clearcoat&&a.enable(7),w.iridescence&&a.enable(8),w.alphaTest&&a.enable(9),w.vertexColors&&a.enable(10),w.vertexAlphas&&a.enable(11),w.vertexUv1s&&a.enable(12),w.vertexUv2s&&a.enable(13),w.vertexUv3s&&a.enable(14),w.vertexTangents&&a.enable(15),w.anisotropy&&a.enable(16),w.alphaHash&&a.enable(17),w.batching&&a.enable(18),w.dispersion&&a.enable(19),w.retroreflection&&a.enable(24),w.batchingColor&&a.enable(20),w.gradientMap&&a.enable(21),w.packedNormalMap&&a.enable(22),w.vertexNormals&&a.enable(23),v.push(a.mask),a.disableAll(),w.fog&&a.enable(0),w.useFog&&a.enable(1),w.flatShading&&a.enable(2),w.logarithmicDepthBuffer&&a.enable(3),w.reversedDepthBuffer&&a.enable(4),w.skinning&&a.enable(5),w.morphTargets&&a.enable(6),w.morphNormals&&a.enable(7),w.morphColors&&a.enable(8),w.premultipliedAlpha&&a.enable(9),w.shadowMapEnabled&&a.enable(10),w.doubleSided&&a.enable(11),w.flipSided&&a.enable(12),w.useDepthPacking&&a.enable(13),w.dithering&&a.enable(14),w.transmission&&a.enable(15),w.sheen&&a.enable(16),w.opaque&&a.enable(17),w.pointsUvs&&a.enable(18),w.decodeVideoTexture&&a.enable(19),w.decodeVideoTextureEmissive&&a.enable(20),w.alphaToCoverage&&a.enable(21),w.numLightProbeGrids>0&&a.enable(22),w.hasPositionAttribute&&a.enable(23),v.push(a.mask)}function P(v){const w=g[v.type];let D;if(w){const U=en[w];D=rd.clone(U.uniforms)}else D=v.uniforms;return D}function M(v,w){let D=u.get(w);return D!==void 0?++D.usedTimes:(D=new Bp(i,w,v,s),c.push(D),u.set(w,D)),D}function T(v){if(--v.usedTimes===0){const w=c.indexOf(v);c[w]=c[c.length-1],c.pop(),u.delete(v.cacheKey),v.destroy()}}function E(v){o.remove(v)}function C(){o.dispose()}return{getParameters:b,getProgramCacheKey:m,getUniforms:P,acquireProgram:M,releaseProgram:T,releaseShaderCache:E,programs:c,dispose:C}}function Wp(){let i=new WeakMap;function e(a){return i.has(a)}function t(a){let o=i.get(a);return o===void 0&&(o={},i.set(a,o)),o}function n(a){i.delete(a)}function s(a,o,l){i.get(a)[o]=l}function r(){i=new WeakMap}return{has:e,get:t,remove:n,update:s,dispose:r}}function Xp(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.material.id!==e.material.id?i.material.id-e.material.id:i.materialVariant!==e.materialVariant?i.materialVariant-e.materialVariant:i.z!==e.z?i.z-e.z:i.id-e.id}function po(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.z!==e.z?e.z-i.z:i.id-e.id}function mo(){const i=[];let e=0;const t=[],n=[],s=[];function r(){e=0,t.length=0,n.length=0,s.length=0}function a(d){let g=0;return d.isInstancedMesh&&(g+=2),d.isSkinnedMesh&&(g+=1),g}function o(d,g,x,b,m,h){let A=i[e];return A===void 0?(A={id:d.id,object:d,geometry:g,material:x,materialVariant:a(d),groupOrder:b,renderOrder:d.renderOrder,z:m,group:h},i[e]=A):(A.id=d.id,A.object=d,A.geometry=g,A.material=x,A.materialVariant=a(d),A.groupOrder=b,A.renderOrder=d.renderOrder,A.z=m,A.group=h),e++,A}function l(d,g,x,b,m,h,A){A.reversedDepth===!0&&(m=-m);const P=o(d,g,x,b,m,h);x.transmission>0?n.push(P):x.transparent===!0?s.push(P):t.push(P)}function c(d,g,x,b,m,h){const A=o(d,g,x,b,m,h);x.transmission>0?n.unshift(A):x.transparent===!0?s.unshift(A):t.unshift(A)}function u(d,g){t.length>1&&t.sort(d||Xp),n.length>1&&n.sort(g||po),s.length>1&&s.sort(g||po)}function p(){for(let d=e,g=i.length;d<g;d++){const x=i[d];if(x.id===null)break;x.id=null,x.object=null,x.geometry=null,x.material=null,x.group=null}}return{opaque:t,transmissive:n,transparent:s,init:r,push:l,unshift:c,finish:p,sort:u}}function qp(){let i=new WeakMap;function e(n,s){const r=i.get(n);let a;return r===void 0?(a=new mo,i.set(n,[a])):s>=r.length?(a=new mo,r.push(a)):a=r[s],a}function t(){i=new WeakMap}return{get:e,dispose:t}}function Yp(){const i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"SunLight":case"DirectionalLight":t={direction:new G,color:new Fe};break;case"SpotLight":t={position:new G,direction:new G,color:new Fe,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new G,color:new Fe,distance:0,decay:0};break;case"HemisphereLight":t={direction:new G,skyColor:new Fe,groundColor:new Fe};break;case"RectAreaLight":t={color:new Fe,position:new G,halfWidth:new G,halfHeight:new G};break}return i[e.id]=t,t}}}function jp(){const i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"SunLight":case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ve};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ve};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ve,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[e.id]=t,t}}}let Kp=0;function Zp(i,e){return(e.castShadow?2:0)-(i.castShadow?2:0)+(e.map?1:0)-(i.map?1:0)}function $p(i){const e=new Yp,t=jp(),n={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new G);const s=new G,r=new ot,a=new ot;function o(c){let u=0,p=0,d=0;for(let k=0;k<9;k++)n.probe[k].set(0,0,0);let g=0,x=0,b=0,m=0,h=0,A=0,P=0,M=0,T=0,E=0,C=0,v=0,w=0,D=0;c.sort(Zp);for(let k=0,W=c.length;k<W;k++){const I=c[k],O=I.color,j=I.intensity,X=I.distance;let ne=null;if(I.shadow&&I.shadow.map&&(I.shadow.map.texture.format===Gn?ne=I.shadow.map.texture:ne=I.shadow.map.depthTexture||I.shadow.map.texture),I.isAmbientLight)u+=O.r*j,p+=O.g*j,d+=O.b*j;else if(I.isLightProbe){for(let q=0;q<9;q++)n.probe[q].addScaledVector(I.sh.coefficients[q],j);D++}else if(I.isSunLight){const q=e.get(I);if(q.color.copy(I.color).multiplyScalar(I.intensity),I.castShadow){const Q=I.shadow,te=t.get(I);te.shadowIntensity=Q.intensity,te.shadowBias=Q.bias,te.shadowNormalBias=Q.normalBias,te.shadowRadius=Q.radius,te.shadowMapSize.copy(Q.mapSize).multiply(Q.getFrameExtents()),n.sunShadow[x]=te,n.sunShadowMap[x]=ne;const Ae=Q.getViewportCount();for(let Te=0;Te<Ae;Te++)n.sunShadowMatrix[b+Te]=Q.getMatrix(Te),n.sunShadowCascade[b+Te]=Q._cascadeData[Te];b+=Ae,x++}n.sun[g]=q,g++}else if(I.isDirectionalLight){const q=e.get(I);if(q.color.copy(I.color).multiplyScalar(I.intensity),I.castShadow){const Q=I.shadow,te=t.get(I);te.shadowIntensity=Q.intensity,te.shadowBias=Q.bias,te.shadowNormalBias=Q.normalBias,te.shadowRadius=Q.radius,te.shadowMapSize=Q.mapSize,n.directionalShadow[m]=te,n.directionalShadowMap[m]=ne,n.directionalShadowMatrix[m]=I.shadow.matrix,T++}n.directional[m]=q,m++}else if(I.isSpotLight){const q=e.get(I);q.position.setFromMatrixPosition(I.matrixWorld),q.color.copy(O).multiplyScalar(j),q.distance=X,q.coneCos=Math.cos(I.angle),q.penumbraCos=Math.cos(I.angle*(1-I.penumbra)),q.decay=I.decay,n.spot[A]=q;const Q=I.shadow;if(I.map&&(n.spotLightMap[v]=I.map,v++,Q.updateMatrices(I),I.castShadow&&w++),n.spotLightMatrix[A]=Q.matrix,I.castShadow){const te=t.get(I);te.shadowIntensity=Q.intensity,te.shadowBias=Q.bias,te.shadowNormalBias=Q.normalBias,te.shadowRadius=Q.radius,te.shadowMapSize=Q.mapSize,n.spotShadow[A]=te,n.spotShadowMap[A]=ne,C++}A++}else if(I.isRectAreaLight){const q=e.get(I);q.color.copy(O).multiplyScalar(j),q.halfWidth.set(I.width*.5,0,0),q.halfHeight.set(0,I.height*.5,0),n.rectArea[P]=q,P++}else if(I.isPointLight){const q=e.get(I);if(q.color.copy(I.color).multiplyScalar(I.intensity),q.distance=I.distance,q.decay=I.decay,I.castShadow){const Q=I.shadow,te=t.get(I);te.shadowIntensity=Q.intensity,te.shadowBias=Q.bias,te.shadowNormalBias=Q.normalBias,te.shadowRadius=Q.radius,te.shadowMapSize=Q.mapSize,te.shadowCameraNear=Q.camera.near,te.shadowCameraFar=Q.camera.far,n.pointShadow[h]=te,n.pointShadowMap[h]=ne,n.pointShadowMatrix[h]=I.shadow.matrix,E++}n.point[h]=q,h++}else if(I.isHemisphereLight){const q=e.get(I);q.skyColor.copy(I.color).multiplyScalar(j),q.groundColor.copy(I.groundColor).multiplyScalar(j),n.hemi[M]=q,M++}}P>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=he.LTC_FLOAT_1,n.rectAreaLTC2=he.LTC_FLOAT_2):(n.rectAreaLTC1=he.LTC_HALF_1,n.rectAreaLTC2=he.LTC_HALF_2)),n.ambient[0]=u,n.ambient[1]=p,n.ambient[2]=d;const U=n.hash;(U.sunLength!==g||U.directionalLength!==m||U.pointLength!==h||U.spotLength!==A||U.rectAreaLength!==P||U.hemiLength!==M||U.numSunShadows!==x||U.numDirectionalShadows!==T||U.numPointShadows!==E||U.numSpotShadows!==C||U.numSpotMaps!==v||U.numLightProbes!==D)&&(n.sun.length=g,n.directional.length=m,n.spot.length=A,n.rectArea.length=P,n.point.length=h,n.hemi.length=M,n.sunShadow.length=x,n.sunShadowMap.length=x,n.sunShadowMatrix.length=b,n.sunShadowCascade.length=b,n.directionalShadow.length=T,n.directionalShadowMap.length=T,n.directionalShadowMatrix.length=T,n.pointShadow.length=E,n.pointShadowMap.length=E,n.pointShadowMatrix.length=E,n.spotShadow.length=C,n.spotShadowMap.length=C,n.spotLightMatrix.length=C+v-w,n.spotLightMap.length=v,n.numSpotLightShadowsWithMaps=w,n.numLightProbes=D,U.sunLength=g,U.directionalLength=m,U.pointLength=h,U.spotLength=A,U.rectAreaLength=P,U.hemiLength=M,U.numSunShadows=x,U.numDirectionalShadows=T,U.numPointShadows=E,U.numSpotShadows=C,U.numSpotMaps=v,U.numLightProbes=D,n.version=Kp++)}function l(c,u){let p=0,d=0,g=0,x=0,b=0,m=0;const h=u.matrixWorldInverse;for(let A=0,P=c.length;A<P;A++){const M=c[A];if(M.isSunLight){const T=n.sun[p];T.direction.setFromMatrixPosition(M.matrixWorld),T.direction.transformDirection(h),p++}else if(M.isDirectionalLight){const T=n.directional[d];T.direction.setFromMatrixPosition(M.matrixWorld),s.setFromMatrixPosition(M.target.matrixWorld),T.direction.sub(s),T.direction.transformDirection(h),d++}else if(M.isSpotLight){const T=n.spot[x];T.position.setFromMatrixPosition(M.matrixWorld),T.position.applyMatrix4(h),T.direction.setFromMatrixPosition(M.matrixWorld),s.setFromMatrixPosition(M.target.matrixWorld),T.direction.sub(s),T.direction.transformDirection(h),x++}else if(M.isRectAreaLight){const T=n.rectArea[b];T.position.setFromMatrixPosition(M.matrixWorld),T.position.applyMatrix4(h),a.identity(),r.copy(M.matrixWorld),r.premultiply(h),a.extractRotation(r),T.halfWidth.set(M.width*.5,0,0),T.halfHeight.set(0,M.height*.5,0),T.halfWidth.applyMatrix4(a),T.halfHeight.applyMatrix4(a),b++}else if(M.isPointLight){const T=n.point[g];T.position.setFromMatrixPosition(M.matrixWorld),T.position.applyMatrix4(h),g++}else if(M.isHemisphereLight){const T=n.hemi[m];T.direction.setFromMatrixPosition(M.matrixWorld),T.direction.transformDirection(h),m++}}}return{setup:o,setupView:l,state:n}}function go(i){const e=new $p(i),t=[],n=[],s=[];function r(d){p.camera=d,t.length=0,n.length=0,s.length=0}function a(d){t.push(d)}function o(d){n.push(d)}function l(d){s.push(d)}function c(){e.setup(t)}function u(d){e.setupView(t,d)}const p={lightsArray:t,shadowsArray:n,lightProbeGridArray:s,camera:null,lights:e,transmissionRenderTarget:{},textureUnits:0};return{init:r,state:p,setupLights:c,setupLightsView:u,pushLight:a,pushShadow:o,pushLightProbeGrid:l}}function Jp(i){let e=new WeakMap;function t(s,r=0){const a=e.get(s);let o;return a===void 0?(o=new go(i),e.set(s,[o])):r>=a.length?(o=new go(i),a.push(o)):o=a[r],o}function n(){e=new WeakMap}return{get:t,dispose:n}}const Qp=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,em=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,tm=[new G(1,0,0),new G(-1,0,0),new G(0,1,0),new G(0,-1,0),new G(0,0,1),new G(0,0,-1)],nm=[new G(0,-1,0),new G(0,-1,0),new G(0,0,1),new G(0,0,-1),new G(0,-1,0),new G(0,-1,0)],xo=new ot,Si=new G,nr=new G;function im(i,e,t){let n=new aa;const s=new Ve,r=new Ve,a=new dt,o=new dd,l=new hd,c={},u=t.maxTextureSize,p={[kn]:Lt,[Lt]:kn,[pn]:pn},d=new ln({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Ve},radius:{value:4}},vertexShader:Qp,fragmentShader:em}),g=d.clone();g.defines.HORIZONTAL_PASS=1;const x=new Kt;x.setAttribute("position",new jt(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const b=new on(x,d),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=os;let h=this.type;this.render=function(E,C,v){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||E.length===0)return;this.type===Zl&&(Re("WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead."),this.type=os);const w=i.getRenderTarget(),D=i.getActiveCubeFace(),U=i.getActiveMipmapLevel(),k=i.state;k.setBlending(gn),k.buffers.depth.getReversed()===!0?k.buffers.color.setClear(0,0,0,0):k.buffers.color.setClear(1,1,1,1),k.buffers.depth.setTest(!0),k.setScissorTest(!1);const W=h!==this.type;W&&C.traverse(function(I){I.material&&(Array.isArray(I.material)?I.material.forEach(O=>O.needsUpdate=!0):I.material.needsUpdate=!0)});for(let I=0,O=E.length;I<O;I++){const j=E[I],X=j.shadow;if(X===void 0){Re("WebGLShadowMap:",j,"has no shadow.");continue}if(X.autoUpdate===!1&&X.needsUpdate===!1)continue;s.copy(X.mapSize);const ne=X.getFrameExtents();s.multiply(ne),r.copy(X.mapSize),(s.x>u||s.y>u)&&(s.x>u&&(r.x=Math.floor(u/ne.x),s.x=r.x*ne.x,X.mapSize.x=r.x),s.y>u&&(r.y=Math.floor(u/ne.y),s.y=r.y*ne.y,X.mapSize.y=r.y));const q=i.state.buffers.depth.getReversed();if(X.camera._reversedDepth=q,X.map===null||W===!0){if(X.map!==null&&(X.map.depthTexture!==null&&(X.map.depthTexture.dispose(),X.map.depthTexture=null),X.map.dispose()),this.type===Mi){if(j.isPointLight){Re("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}X.map=new Yt(s.x,s.y,{format:Gn,type:an,minFilter:Tt,magFilter:Tt,generateMipmaps:!1}),X.map.texture.name=j.name+".shadowMap",X.map.depthTexture=new Ci(s.x,s.y,tn),X.map.depthTexture.name=j.name+".shadowMapDepth",X.map.depthTexture.format=vn,X.map.depthTexture.compareFunction=null,X.map.depthTexture.minFilter=St,X.map.depthTexture.magFilter=St}else j.isPointLight?(X.map=new al(s.x),X.map.depthTexture=new id(s.x,rn)):(X.map=new Yt(s.x,s.y),X.map.depthTexture=new Ci(s.x,s.y,rn)),X.map.depthTexture.name=j.name+".shadowMap",X.map.depthTexture.format=vn,this.type===os?(X.map.depthTexture.compareFunction=q?sa:ia,X.map.depthTexture.minFilter=Tt,X.map.depthTexture.magFilter=Tt):(X.map.depthTexture.compareFunction=null,X.map.depthTexture.minFilter=St,X.map.depthTexture.magFilter=St);X.camera.updateProjectionMatrix()}X.map.isWebGLCubeRenderTarget!==!0&&(X.map.width!==s.x||X.map.height!==s.y)&&X.map.setSize(s.x,s.y);const Q=X.map.isWebGLCubeRenderTarget?6:X.getViewportCount();j.isPointLight!==!0&&X.updateMatrices(j,v);for(let te=0;te<Q;te++){const Ae=X.getCamera(te);if(j.isPointLight){const Te=X.camera,et=X.matrix,Ge=j.distance||Te.far;Ge!==Te.far&&(Te.far=Ge,Te.updateProjectionMatrix()),Si.setFromMatrixPosition(j.matrixWorld),Te.position.copy(Si),nr.copy(Te.position),nr.add(tm[te]),Te.up.copy(nm[te]),Te.lookAt(nr),Te.updateMatrixWorld(),et.makeTranslation(-Si.x,-Si.y,-Si.z),xo.multiplyMatrices(Te.projectionMatrix,Te.matrixWorldInverse),X._frustum.setFromProjectionMatrix(xo,Te.coordinateSystem,Te.reversedDepth)}if(X.map.isWebGLCubeRenderTarget)i.setRenderTarget(X.map,te),i.clear();else{te===0&&(i.setRenderTarget(X.map),i.clear());const Te=X.getViewport(te);a.set(r.x*Te.x,r.y*Te.y,r.x*Te.z,r.y*Te.w),k.viewport(a)}n=X.getFrustum(te),M(C,v,Ae,j,this.type)}X.isPointLightShadow!==!0&&this.type===Mi&&A(X,v),X.needsUpdate=!1}h=this.type,m.needsUpdate=!1,i.setRenderTarget(w,D,U)};function A(E,C){const v=e.update(b);d.defines.VSM_SAMPLES!==E.blurSamples&&(d.defines.VSM_SAMPLES=E.blurSamples,g.defines.VSM_SAMPLES=E.blurSamples,d.needsUpdate=!0,g.needsUpdate=!0),E.mapPass===null?E.mapPass=new Yt(s.x,s.y,{format:Gn,type:an}):(E.mapPass.width!==E.map.width||E.mapPass.height!==E.map.height)&&E.mapPass.setSize(E.map.width,E.map.height),d.uniforms.shadow_pass.value=E.map.depthTexture,d.uniforms.resolution.value.set(E.map.width,E.map.height),d.uniforms.radius.value=E.radius,i.setRenderTarget(E.mapPass),i.clear(),i.renderBufferDirect(C,null,v,d,b,null),g.uniforms.shadow_pass.value=E.mapPass.texture,g.uniforms.resolution.value.set(E.map.width,E.map.height),g.uniforms.radius.value=E.radius,i.setRenderTarget(E.map),i.clear(),i.renderBufferDirect(C,null,v,g,b,null)}function P(E,C,v,w){let D=null;const U=v.isPointLight===!0?E.customDistanceMaterial:E.customDepthMaterial;if(U!==void 0)D=U;else if(D=v.isPointLight===!0?l:o,i.localClippingEnabled&&C.clipShadows===!0&&Array.isArray(C.clippingPlanes)&&C.clippingPlanes.length!==0||C.displacementMap&&C.displacementScale!==0||C.alphaMap&&C.alphaTest>0||C.map&&C.alphaTest>0||C.alphaToCoverage===!0){const k=D.uuid,W=C.uuid;let I=c[k];I===void 0&&(I={},c[k]=I);let O=I[W];O===void 0&&(O=D.clone(),I[W]=O,C.addEventListener("dispose",T)),D=O}if(D.visible=C.visible,D.wireframe=C.wireframe,w===Mi?D.side=C.shadowSide!==null?C.shadowSide:C.side:D.side=C.shadowSide!==null?C.shadowSide:p[C.side],D.alphaMap=C.alphaMap,D.alphaTest=C.alphaToCoverage===!0?.5:C.alphaTest,D.map=C.map,D.clipShadows=C.clipShadows,D.clippingPlanes=C.clippingPlanes,D.clipIntersection=C.clipIntersection,D.displacementMap=C.displacementMap,D.displacementScale=C.displacementScale,D.displacementBias=C.displacementBias,D.wireframeLinewidth=C.wireframeLinewidth,D.linewidth=C.linewidth,v.isPointLight===!0&&D.isMeshDistanceMaterial===!0){const k=i.properties.get(D);k.light=v}return D}function M(E,C,v,w,D){if(E.visible===!1)return;if(E.layers.test(C.layers)&&(E.isMesh||E.isLine||E.isPoints)&&(E.castShadow||E.receiveShadow&&D===Mi)&&(!E.frustumCulled||E.intersectsFrustum(n))){E.modelViewMatrix.multiplyMatrices(v.matrixWorldInverse,E.matrixWorld);const W=e.update(E),I=E.material;if(Array.isArray(I)){const O=W.groups;for(let j=0,X=O.length;j<X;j++){const ne=O[j],q=I[ne.materialIndex];if(q&&q.visible){const Q=P(E,q,w,D);E.onBeforeShadow(i,E,C,v,W,Q,ne),i.renderBufferDirect(v,null,W,Q,E,ne),E.onAfterShadow(i,E,C,v,W,Q,ne)}}}else if(I.visible){const O=P(E,I,w,D);E.onBeforeShadow(i,E,C,v,W,O,null),i.renderBufferDirect(v,null,W,O,E,null),E.onAfterShadow(i,E,C,v,W,O,null)}}const k=E.children;for(let W=0,I=k.length;W<I;W++)M(k[W],C,v,w,D)}function T(E){E.target.removeEventListener("dispose",T);for(const v in c){const w=c[v],D=E.target.uuid;D in w&&(w[D].dispose(),delete w[D])}}}function sm(i,e){function t(){let N=!1;const le=new dt;let $=null;const ce=new dt(0,0,0,0);return{setMask:function(pe){$!==pe&&!N&&(i.colorMask(pe,pe,pe,pe),$=pe)},setLocked:function(pe){N=pe},setClear:function(pe,ie,we,Me,nt){nt===!0&&(pe*=Me,ie*=Me,we*=Me),le.set(pe,ie,we,Me),ce.equals(le)===!1&&(i.clearColor(pe,ie,we,Me),ce.copy(le))},reset:function(){N=!1,$=null,ce.set(-1,0,0,0)}}}function n(){let N=!1,le=!1,$=null,ce=null,pe=null;return{setReversed:function(ie){if(le!==ie){const we=e.get("EXT_clip_control");ie?we.clipControlEXT(we.LOWER_LEFT_EXT,we.ZERO_TO_ONE_EXT):we.clipControlEXT(we.LOWER_LEFT_EXT,we.NEGATIVE_ONE_TO_ONE_EXT),le=ie;const Me=pe;pe=null,this.setClear(Me)}},getReversed:function(){return le},setTest:function(ie){ie?ee(i.DEPTH_TEST):_e(i.DEPTH_TEST)},setMask:function(ie){$!==ie&&!N&&(i.depthMask(ie),$=ie)},setFunc:function(ie){if(le&&(ie=Nc[ie]),ce!==ie){switch(ie){case sr:i.depthFunc(i.NEVER);break;case rr:i.depthFunc(i.ALWAYS);break;case ar:i.depthFunc(i.LESS);break;case yi:i.depthFunc(i.LEQUAL);break;case or:i.depthFunc(i.EQUAL);break;case lr:i.depthFunc(i.GEQUAL);break;case cr:i.depthFunc(i.GREATER);break;case dr:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}ce=ie}},setLocked:function(ie){N=ie},setClear:function(ie){pe!==ie&&(pe=ie,le&&(ie=1-ie),i.clearDepth(ie))},reset:function(){N=!1,$=null,ce=null,pe=null,le=!1}}}function s(){let N=!1,le=null,$=null,ce=null,pe=null,ie=null,we=null,Me=null,nt=null;return{setTest:function(je){N||(je?ee(i.STENCIL_TEST):_e(i.STENCIL_TEST))},setMask:function(je){le!==je&&!N&&(i.stencilMask(je),le=je)},setFunc:function(je,Ht,Zt){($!==je||ce!==Ht||pe!==Zt)&&(i.stencilFunc(je,Ht,Zt),$=je,ce=Ht,pe=Zt)},setOp:function(je,Ht,Zt){(ie!==je||we!==Ht||Me!==Zt)&&(i.stencilOp(je,Ht,Zt),ie=je,we=Ht,Me=Zt)},setLocked:function(je){N=je},setClear:function(je){nt!==je&&(i.clearStencil(je),nt=je)},reset:function(){N=!1,le=null,$=null,ce=null,pe=null,ie=null,we=null,Me=null,nt=null}}}const r=new t,a=new n,o=new s,l=new WeakMap,c=new WeakMap;let u={},p={},d={},g=new WeakMap,x=[],b=null,m=!1,h=null,A=null,P=null,M=null,T=null,E=null,C=null,v=new Fe(0,0,0),w=0,D=!1,U=null,k=null,W=null,I=null,O=null;const j=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let X=!1,ne=0;const q=i.getParameter(i.VERSION);q.indexOf("WebGL")!==-1?(ne=parseFloat(/^WebGL (\d)/.exec(q)[1]),X=ne>=1):q.indexOf("OpenGL ES")!==-1&&(ne=parseFloat(/^OpenGL ES (\d)/.exec(q)[1]),X=ne>=2);let Q=null,te={};const Ae=i.getParameter(i.SCISSOR_BOX),Te=i.getParameter(i.VIEWPORT),et=new dt().fromArray(Ae),Ge=new dt().fromArray(Te);function Ye(N,le,$,ce){const pe=new Uint8Array(4),ie=i.createTexture();i.bindTexture(N,ie),i.texParameteri(N,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(N,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let we=0;we<$;we++)N===i.TEXTURE_3D||N===i.TEXTURE_2D_ARRAY?i.texImage3D(le,0,i.RGBA,1,1,ce,0,i.RGBA,i.UNSIGNED_BYTE,pe):i.texImage2D(le+we,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,pe);return ie}const K={};K[i.TEXTURE_2D]=Ye(i.TEXTURE_2D,i.TEXTURE_2D,1),K[i.TEXTURE_CUBE_MAP]=Ye(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),K[i.TEXTURE_2D_ARRAY]=Ye(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),K[i.TEXTURE_3D]=Ye(i.TEXTURE_3D,i.TEXTURE_3D,1,1),r.setClear(0,0,0,1),a.setClear(1),o.setClear(0),ee(i.DEPTH_TEST),a.setFunc(yi),ze(!1),rt(Sa),ee(i.CULL_FACE),Xe(gn);function ee(N){u[N]!==!0&&(i.enable(N),u[N]=!0)}function _e(N){u[N]!==!1&&(i.disable(N),u[N]=!1)}function Pe(N,le){return d[N]!==le?(i.bindFramebuffer(N,le),d[N]=le,N===i.DRAW_FRAMEBUFFER&&(d[i.FRAMEBUFFER]=le),N===i.FRAMEBUFFER&&(d[i.DRAW_FRAMEBUFFER]=le),!0):!1}function ge(N,le){let $=x,ce=!1;if(N){$=g.get(le),$===void 0&&($=[],g.set(le,$));const pe=N.textures;if($.length!==pe.length||$[0]!==i.COLOR_ATTACHMENT0){for(let ie=0,we=pe.length;ie<we;ie++)$[ie]=i.COLOR_ATTACHMENT0+ie;$.length=pe.length,ce=!0}}else $[0]!==i.BACK&&($[0]=i.BACK,ce=!0);ce&&i.drawBuffers($)}function Ue(N){return b!==N?(i.useProgram(N),b=N,!0):!1}const mt={[ri]:i.FUNC_ADD,[Jl]:i.FUNC_SUBTRACT,[Ql]:i.FUNC_REVERSE_SUBTRACT};mt[ec]=i.MIN,mt[tc]=i.MAX;const Oe={[nc]:i.ZERO,[ic]:i.ONE,[sc]:i.SRC_COLOR,[yo]:i.SRC_ALPHA,[dc]:i.SRC_ALPHA_SATURATE,[lc]:i.DST_COLOR,[ac]:i.DST_ALPHA,[rc]:i.ONE_MINUS_SRC_COLOR,[To]:i.ONE_MINUS_SRC_ALPHA,[cc]:i.ONE_MINUS_DST_COLOR,[oc]:i.ONE_MINUS_DST_ALPHA,[hc]:i.CONSTANT_COLOR,[uc]:i.ONE_MINUS_CONSTANT_COLOR,[fc]:i.CONSTANT_ALPHA,[pc]:i.ONE_MINUS_CONSTANT_ALPHA};function Xe(N,le,$,ce,pe,ie,we,Me,nt,je){if(N===gn){m===!0&&(_e(i.BLEND),m=!1);return}if(m===!1&&(ee(i.BLEND),m=!0),N!==$l){if(N!==h||je!==D){if((A!==ri||T!==ri)&&(i.blendEquation(i.FUNC_ADD),A=ri,T=ri),je)switch(N){case Ei:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case ir:i.blendFunc(i.ONE,i.ONE);break;case Ma:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case ba:i.blendFuncSeparate(i.DST_COLOR,i.ONE_MINUS_SRC_ALPHA,i.ZERO,i.ONE);break;default:qe("WebGLState: Invalid blending: ",N);break}else switch(N){case Ei:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case ir:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE,i.ONE,i.ONE);break;case Ma:qe("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case ba:qe("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:qe("WebGLState: Invalid blending: ",N);break}P=null,M=null,E=null,C=null,v.set(0,0,0),w=0,h=N,D=je}return}pe=pe||le,ie=ie||$,we=we||ce,(le!==A||pe!==T)&&(i.blendEquationSeparate(mt[le],mt[pe]),A=le,T=pe),($!==P||ce!==M||ie!==E||we!==C)&&(i.blendFuncSeparate(Oe[$],Oe[ce],Oe[ie],Oe[we]),P=$,M=ce,E=ie,C=we),(Me.equals(v)===!1||nt!==w)&&(i.blendColor(Me.r,Me.g,Me.b,nt),v.copy(Me),w=nt),h=N,D=!1}function tt(N,le){N.side===pn?_e(i.CULL_FACE):ee(i.CULL_FACE);let $=N.side===Lt;le&&($=!$),ze($),N.blending===Ei&&N.transparent===!1?Xe(gn):Xe(N.blending,N.blendEquation,N.blendSrc,N.blendDst,N.blendEquationAlpha,N.blendSrcAlpha,N.blendDstAlpha,N.blendColor,N.blendAlpha,N.premultipliedAlpha),a.setFunc(N.depthFunc),a.setTest(N.depthTest),a.setMask(N.depthWrite),r.setMask(N.colorWrite);const ce=N.stencilWrite;o.setTest(ce),ce&&(o.setMask(N.stencilWriteMask),o.setFunc(N.stencilFunc,N.stencilRef,N.stencilFuncMask),o.setOp(N.stencilFail,N.stencilZFail,N.stencilZPass)),Pt(N.polygonOffset,N.polygonOffsetFactor,N.polygonOffsetUnits),N.alphaToCoverage===!0?ee(i.SAMPLE_ALPHA_TO_COVERAGE):_e(i.SAMPLE_ALPHA_TO_COVERAGE)}function ze(N){U!==N&&(N?i.frontFace(i.CW):i.frontFace(i.CCW),U=N)}function rt(N){N!==jl?(ee(i.CULL_FACE),N!==k&&(N===Sa?i.cullFace(i.BACK):N===Kl?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):_e(i.CULL_FACE),k=N}function _t(N){N!==W&&(X&&i.lineWidth(N),W=N)}function Pt(N,le,$){N?(ee(i.POLYGON_OFFSET_FILL),(I!==le||O!==$)&&(I=le,O=$,a.getReversed()&&(le=-le),i.polygonOffset(le,$))):_e(i.POLYGON_OFFSET_FILL)}function lt(N){N?ee(i.SCISSOR_TEST):_e(i.SCISSOR_TEST)}function ut(N){N===void 0&&(N=i.TEXTURE0+j-1),Q!==N&&(i.activeTexture(N),Q=N)}function L(N,le,$){$===void 0&&(Q===null?$=i.TEXTURE0+j-1:$=Q);let ce=te[$];ce===void 0&&(ce={type:void 0,texture:void 0},te[$]=ce),(ce.type!==N||ce.texture!==le)&&(Q!==$&&(i.activeTexture($),Q=$),i.bindTexture(N,le||K[N]),ce.type=N,ce.texture=le)}function Mt(){const N=te[Q];N!==void 0&&N.type!==void 0&&(i.bindTexture(N.type,null),N.type=void 0,N.texture=void 0)}function Ze(){try{i.compressedTexImage2D(...arguments)}catch(N){qe("WebGLState:",N)}}function y(){try{i.compressedTexImage3D(...arguments)}catch(N){qe("WebGLState:",N)}}function f(){try{i.texSubImage2D(...arguments)}catch(N){qe("WebGLState:",N)}}function F(){try{i.texSubImage3D(...arguments)}catch(N){qe("WebGLState:",N)}}function H(){try{i.compressedTexSubImage2D(...arguments)}catch(N){qe("WebGLState:",N)}}function Y(){try{i.compressedTexSubImage3D(...arguments)}catch(N){qe("WebGLState:",N)}}function se(){try{i.texStorage2D(...arguments)}catch(N){qe("WebGLState:",N)}}function re(){try{i.texStorage3D(...arguments)}catch(N){qe("WebGLState:",N)}}function Z(){try{i.texImage2D(...arguments)}catch(N){qe("WebGLState:",N)}}function J(){try{i.texImage3D(...arguments)}catch(N){qe("WebGLState:",N)}}function ae(N){return p[N]!==void 0?p[N]:i.getParameter(N)}function Ee(N,le){p[N]!==le&&(i.pixelStorei(N,le),p[N]=le)}function de(N){et.equals(N)===!1&&(i.scissor(N.x,N.y,N.z,N.w),et.copy(N))}function oe(N){Ge.equals(N)===!1&&(i.viewport(N.x,N.y,N.z,N.w),Ge.copy(N))}function ye(N,le){let $=c.get(le);$===void 0&&($=new WeakMap,c.set(le,$));let ce=$.get(N);ce===void 0&&(ce=i.getUniformBlockIndex(le,N.name),$.set(N,ce))}function Ce(N,le){const ce=c.get(le).get(N);l.get(le)!==ce&&(i.uniformBlockBinding(le,ce,N.__bindingPointIndex),l.set(le,ce))}function Le(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),a.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),i.pixelStorei(i.PACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,!1),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,i.BROWSER_DEFAULT_WEBGL),i.pixelStorei(i.PACK_ROW_LENGTH,0),i.pixelStorei(i.PACK_SKIP_PIXELS,0),i.pixelStorei(i.PACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_ROW_LENGTH,0),i.pixelStorei(i.UNPACK_IMAGE_HEIGHT,0),i.pixelStorei(i.UNPACK_SKIP_PIXELS,0),i.pixelStorei(i.UNPACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_SKIP_IMAGES,0),u={},p={},Q=null,te={},d={},g=new WeakMap,x=[],b=null,m=!1,h=null,A=null,P=null,M=null,T=null,E=null,C=null,v=new Fe(0,0,0),w=0,D=!1,U=null,k=null,W=null,I=null,O=null,et.set(0,0,i.canvas.width,i.canvas.height),Ge.set(0,0,i.canvas.width,i.canvas.height),r.reset(),a.reset(),o.reset()}return{buffers:{color:r,depth:a,stencil:o},enable:ee,disable:_e,bindFramebuffer:Pe,drawBuffers:ge,useProgram:Ue,setBlending:Xe,setMaterial:tt,setFlipSided:ze,setCullFace:rt,setLineWidth:_t,setPolygonOffset:Pt,setScissorTest:lt,activeTexture:ut,bindTexture:L,unbindTexture:Mt,compressedTexImage2D:Ze,compressedTexImage3D:y,texImage2D:Z,texImage3D:J,pixelStorei:Ee,getParameter:ae,updateUBOMapping:ye,uniformBlockBinding:Ce,texStorage2D:se,texStorage3D:re,texSubImage2D:f,texSubImage3D:F,compressedTexSubImage2D:H,compressedTexSubImage3D:Y,scissor:de,viewport:oe,reset:Le}}function rm(i,e,t,n,s,r,a){const o=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new Ve,u=new WeakMap,p=new Set;let d;const g=new WeakMap;let x=!1;try{x=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function b(y,f){return x?new OffscreenCanvas(y,f):xs("canvas")}function m(y,f,F){let H=1;const Y=Ze(y);if((Y.width>F||Y.height>F)&&(H=F/Math.max(Y.width,Y.height)),H<1)if(typeof HTMLImageElement<"u"&&y instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&y instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&y instanceof ImageBitmap||typeof VideoFrame<"u"&&y instanceof VideoFrame){const se=Math.floor(H*Y.width),re=Math.floor(H*Y.height);d===void 0&&(d=b(se,re));const Z=f?b(se,re):d;return Z.width=se,Z.height=re,Z.getContext("2d").drawImage(y,0,0,se,re),Re("WebGLRenderer: Texture has been resized from ("+Y.width+"x"+Y.height+") to ("+se+"x"+re+")."),Z}else return"data"in y&&Re("WebGLRenderer: Image in DataTexture is too big ("+Y.width+"x"+Y.height+")."),y;return y}function h(y){return y.generateMipmaps}function A(y){i.generateMipmap(y)}function P(y){return y.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:y.isWebGL3DRenderTarget?i.TEXTURE_3D:y.isWebGLArrayRenderTarget||y.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function M(y,f,F,H,Y,se=!1){if(y!==null){if(i[y]!==void 0)return i[y];Re("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+y+"'")}let re;H&&(re=e.get("EXT_texture_norm16"),re||Re("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let Z=f;if(f===i.RED&&(F===i.FLOAT&&(Z=i.R32F),F===i.HALF_FLOAT&&(Z=i.R16F),F===i.UNSIGNED_BYTE&&(Z=i.R8),F===i.UNSIGNED_SHORT&&re&&(Z=re.R16_EXT),F===i.SHORT&&re&&(Z=re.R16_SNORM_EXT)),f===i.RED_INTEGER&&(F===i.UNSIGNED_BYTE&&(Z=i.R8UI),F===i.UNSIGNED_SHORT&&(Z=i.R16UI),F===i.UNSIGNED_INT&&(Z=i.R32UI),F===i.BYTE&&(Z=i.R8I),F===i.SHORT&&(Z=i.R16I),F===i.INT&&(Z=i.R32I)),f===i.RG&&(F===i.FLOAT&&(Z=i.RG32F),F===i.HALF_FLOAT&&(Z=i.RG16F),F===i.UNSIGNED_BYTE&&(Z=i.RG8),F===i.UNSIGNED_SHORT&&re&&(Z=re.RG16_EXT),F===i.SHORT&&re&&(Z=re.RG16_SNORM_EXT)),f===i.RG_INTEGER&&(F===i.UNSIGNED_BYTE&&(Z=i.RG8UI),F===i.UNSIGNED_SHORT&&(Z=i.RG16UI),F===i.UNSIGNED_INT&&(Z=i.RG32UI),F===i.BYTE&&(Z=i.RG8I),F===i.SHORT&&(Z=i.RG16I),F===i.INT&&(Z=i.RG32I)),f===i.RGB_INTEGER&&(F===i.UNSIGNED_BYTE&&(Z=i.RGB8UI),F===i.UNSIGNED_SHORT&&(Z=i.RGB16UI),F===i.UNSIGNED_INT&&(Z=i.RGB32UI),F===i.BYTE&&(Z=i.RGB8I),F===i.SHORT&&(Z=i.RGB16I),F===i.INT&&(Z=i.RGB32I)),f===i.RGBA_INTEGER&&(F===i.UNSIGNED_BYTE&&(Z=i.RGBA8UI),F===i.UNSIGNED_SHORT&&(Z=i.RGBA16UI),F===i.UNSIGNED_INT&&(Z=i.RGBA32UI),F===i.BYTE&&(Z=i.RGBA8I),F===i.SHORT&&(Z=i.RGBA16I),F===i.INT&&(Z=i.RGBA32I)),f===i.RGB&&(F===i.UNSIGNED_SHORT&&re&&(Z=re.RGB16_EXT),F===i.SHORT&&re&&(Z=re.RGB16_SNORM_EXT),F===i.UNSIGNED_INT_5_9_9_9_REV&&(Z=i.RGB9_E5),F===i.UNSIGNED_INT_10F_11F_11F_REV&&(Z=i.R11F_G11F_B10F)),f===i.RGBA){const J=se?gs:ke.getTransfer(Y);F===i.FLOAT&&(Z=i.RGBA32F),F===i.HALF_FLOAT&&(Z=i.RGBA16F),F===i.UNSIGNED_BYTE&&(Z=J===$e?i.SRGB8_ALPHA8:i.RGBA8),F===i.UNSIGNED_SHORT&&re&&(Z=re.RGBA16_EXT),F===i.SHORT&&re&&(Z=re.RGBA16_SNORM_EXT),F===i.UNSIGNED_SHORT_4_4_4_4&&(Z=i.RGBA4),F===i.UNSIGNED_SHORT_5_5_5_1&&(Z=i.RGB5_A1)}return(Z===i.R16F||Z===i.R32F||Z===i.RG16F||Z===i.RG32F||Z===i.RGBA16F||Z===i.RGBA32F)&&e.get("EXT_color_buffer_float"),Z}function T(y,f){let F;return y?f===null||f===rn||f===wi?F=i.DEPTH24_STENCIL8:f===tn?F=i.DEPTH32F_STENCIL8:f===Ti&&(F=i.DEPTH24_STENCIL8,Re("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):f===null||f===rn||f===wi?F=i.DEPTH_COMPONENT24:f===tn?F=i.DEPTH_COMPONENT32F:f===Ti&&(F=i.DEPTH_COMPONENT16),F}function E(y,f){return h(y)===!0||y.isFramebufferTexture&&y.minFilter!==St&&y.minFilter!==Tt?Math.log2(Math.max(f.width,f.height))+1:y.mipmaps!==void 0&&y.mipmaps.length>0?y.mipmaps.length:y.isCompressedTexture&&Array.isArray(y.image)?f.mipmaps.length:1}function C(y){const f=y.target;f.removeEventListener("dispose",C),w(f),f.isVideoTexture&&u.delete(f),f.isHTMLTexture&&p.delete(f)}function v(y){const f=y.target;f.removeEventListener("dispose",v),U(f)}function w(y){const f=n.get(y);if(f.__webglInit===void 0)return;const F=y.source,H=g.get(F);if(H){const Y=H[f.__cacheKey];Y.usedTimes--,Y.usedTimes===0&&D(y),Object.keys(H).length===0&&g.delete(F)}n.remove(y)}function D(y){const f=n.get(y);i.deleteTexture(f.__webglTexture);const F=y.source,H=g.get(F);delete H[f.__cacheKey],a.memory.textures--}function U(y){const f=n.get(y);if(y.depthTexture&&(y.depthTexture.dispose(),n.remove(y.depthTexture)),y.isWebGLCubeRenderTarget)for(let H=0;H<6;H++){if(Array.isArray(f.__webglFramebuffer[H]))for(let Y=0;Y<f.__webglFramebuffer[H].length;Y++)i.deleteFramebuffer(f.__webglFramebuffer[H][Y]);else i.deleteFramebuffer(f.__webglFramebuffer[H]);f.__webglDepthbuffer&&i.deleteRenderbuffer(f.__webglDepthbuffer[H])}else{if(Array.isArray(f.__webglFramebuffer))for(let H=0;H<f.__webglFramebuffer.length;H++)i.deleteFramebuffer(f.__webglFramebuffer[H]);else i.deleteFramebuffer(f.__webglFramebuffer);if(f.__webglDepthbuffer&&i.deleteRenderbuffer(f.__webglDepthbuffer),f.__webglMultisampledFramebuffer&&i.deleteFramebuffer(f.__webglMultisampledFramebuffer),f.__webglColorRenderbuffer)for(let H=0;H<f.__webglColorRenderbuffer.length;H++)f.__webglColorRenderbuffer[H]&&i.deleteRenderbuffer(f.__webglColorRenderbuffer[H]);f.__webglDepthRenderbuffer&&i.deleteRenderbuffer(f.__webglDepthRenderbuffer)}const F=y.textures;for(let H=0,Y=F.length;H<Y;H++){const se=n.get(F[H]);se.__webglTexture&&(i.deleteTexture(se.__webglTexture),a.memory.textures--),n.remove(F[H])}n.remove(y)}let k=0;function W(){k=0}function I(){return k}function O(y){k=y}function j(){const y=k;return y>=s.maxTextures&&Re("WebGLTextures: Trying to use "+(y+1)+" texture units while this GPU supports only "+s.maxTextures),k+=1,y}function X(y){const f=[];return f.push(y.wrapS),f.push(y.wrapT),f.push(y.wrapR||0),f.push(y.magFilter),f.push(y.minFilter),f.push(y.anisotropy),f.push(y.internalFormat),f.push(y.format),f.push(y.type),f.push(y.generateMipmaps),f.push(y.premultiplyAlpha),f.push(y.flipY),f.push(y.unpackAlignment),f.push(y.colorSpace),f.join()}function ne(y,f){const F=n.get(y);if(y.isVideoTexture&&L(y),y.isRenderTargetTexture===!1&&y.isExternalTexture!==!0&&y.version>0&&F.__version!==y.version){const H=y.image;if(H===null)Re("WebGLRenderer: Texture marked for update but no image data found.");else if(H.complete===!1)Re("WebGLRenderer: Texture marked for update but image is incomplete");else{_e(F,y,f);return}}else y.isExternalTexture&&(F.__webglTexture=y.sourceTexture?y.sourceTexture:null);t.bindTexture(i.TEXTURE_2D,F.__webglTexture,i.TEXTURE0+f)}function q(y,f){const F=n.get(y);if(y.isRenderTargetTexture===!1&&y.version>0&&F.__version!==y.version){_e(F,y,f);return}else y.isExternalTexture&&(F.__webglTexture=y.sourceTexture?y.sourceTexture:null);t.bindTexture(i.TEXTURE_2D_ARRAY,F.__webglTexture,i.TEXTURE0+f)}function Q(y,f){const F=n.get(y);if(y.isRenderTargetTexture===!1&&y.version>0&&F.__version!==y.version){_e(F,y,f);return}t.bindTexture(i.TEXTURE_3D,F.__webglTexture,i.TEXTURE0+f)}function te(y,f){const F=n.get(y);if(y.isCubeDepthTexture!==!0&&y.version>0&&F.__version!==y.version){Pe(F,y,f);return}t.bindTexture(i.TEXTURE_CUBE_MAP,F.__webglTexture,i.TEXTURE0+f)}const Ae={[hr]:i.REPEAT,[mn]:i.CLAMP_TO_EDGE,[ur]:i.MIRRORED_REPEAT},Te={[St]:i.NEAREST,[xc]:i.NEAREST_MIPMAP_NEAREST,[Fi]:i.NEAREST_MIPMAP_LINEAR,[Tt]:i.LINEAR,[ws]:i.LINEAR_MIPMAP_NEAREST,[Bn]:i.LINEAR_MIPMAP_LINEAR},et={[Mc]:i.NEVER,[wc]:i.ALWAYS,[bc]:i.LESS,[ia]:i.LEQUAL,[Ec]:i.EQUAL,[sa]:i.GEQUAL,[yc]:i.GREATER,[Tc]:i.NOTEQUAL};function Ge(y,f){if(f.type===tn&&e.has("OES_texture_float_linear")===!1&&(f.magFilter===Tt||f.magFilter===ws||f.magFilter===Fi||f.magFilter===Bn||f.minFilter===Tt||f.minFilter===ws||f.minFilter===Fi||f.minFilter===Bn)&&Re("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(y,i.TEXTURE_WRAP_S,Ae[f.wrapS]),i.texParameteri(y,i.TEXTURE_WRAP_T,Ae[f.wrapT]),(y===i.TEXTURE_3D||y===i.TEXTURE_2D_ARRAY)&&i.texParameteri(y,i.TEXTURE_WRAP_R,Ae[f.wrapR]),i.texParameteri(y,i.TEXTURE_MAG_FILTER,Te[f.magFilter]),i.texParameteri(y,i.TEXTURE_MIN_FILTER,Te[f.minFilter]),f.compareFunction&&(i.texParameteri(y,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(y,i.TEXTURE_COMPARE_FUNC,et[f.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(f.magFilter===St||f.minFilter!==Fi&&f.minFilter!==Bn||f.type===tn&&e.has("OES_texture_float_linear")===!1)return;if(f.anisotropy>1||n.get(f).__currentAnisotropy){const F=e.get("EXT_texture_filter_anisotropic");i.texParameterf(y,F.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(f.anisotropy,s.getMaxAnisotropy())),n.get(f).__currentAnisotropy=f.anisotropy}}}function Ye(y,f){let F=!1;y.__webglInit===void 0&&(y.__webglInit=!0,f.addEventListener("dispose",C));const H=f.source;let Y=g.get(H);Y===void 0&&(Y={},g.set(H,Y));const se=X(f);if(se!==y.__cacheKey){Y[se]===void 0&&(Y[se]={texture:i.createTexture(),usedTimes:0},a.memory.textures++,F=!0),Y[se].usedTimes++;const re=Y[y.__cacheKey];re!==void 0&&(Y[y.__cacheKey].usedTimes--,re.usedTimes===0&&D(f)),y.__cacheKey=se,y.__webglTexture=Y[se].texture}return F}function K(y,f,F){return Math.floor(Math.floor(y/F)/f)}function ee(y,f,F,H){const se=y.updateRanges;if(se.length===0)t.texSubImage2D(i.TEXTURE_2D,0,0,0,f.width,f.height,F,H,f.data);else{se.sort((Ee,de)=>Ee.start-de.start);let re=0;for(let Ee=1;Ee<se.length;Ee++){const de=se[re],oe=se[Ee],ye=de.start+de.count,Ce=K(oe.start,f.width,4),Le=K(de.start,f.width,4);oe.start<=ye+1&&Ce===Le&&K(oe.start+oe.count-1,f.width,4)===Ce?de.count=Math.max(de.count,oe.start+oe.count-de.start):(++re,se[re]=oe)}se.length=re+1;const Z=t.getParameter(i.UNPACK_ROW_LENGTH),J=t.getParameter(i.UNPACK_SKIP_PIXELS),ae=t.getParameter(i.UNPACK_SKIP_ROWS);t.pixelStorei(i.UNPACK_ROW_LENGTH,f.width);for(let Ee=0,de=se.length;Ee<de;Ee++){const oe=se[Ee],ye=Math.floor(oe.start/4),Ce=Math.ceil(oe.count/4),Le=ye%f.width,N=Math.floor(ye/f.width),le=Ce,$=1;t.pixelStorei(i.UNPACK_SKIP_PIXELS,Le),t.pixelStorei(i.UNPACK_SKIP_ROWS,N),t.texSubImage2D(i.TEXTURE_2D,0,Le,N,le,$,F,H,f.data)}y.clearUpdateRanges(),t.pixelStorei(i.UNPACK_ROW_LENGTH,Z),t.pixelStorei(i.UNPACK_SKIP_PIXELS,J),t.pixelStorei(i.UNPACK_SKIP_ROWS,ae)}}function _e(y,f,F){let H=i.TEXTURE_2D;(f.isDataArrayTexture||f.isCompressedArrayTexture)&&(H=i.TEXTURE_2D_ARRAY),f.isData3DTexture&&(H=i.TEXTURE_3D);const Y=Ye(y,f),se=f.source;t.bindTexture(H,y.__webglTexture,i.TEXTURE0+F);const re=n.get(se);if(se.version!==re.__version||Y===!0){if(t.activeTexture(i.TEXTURE0+F),(typeof ImageBitmap<"u"&&f.image instanceof ImageBitmap)===!1){const $=ke.getPrimaries(ke.workingColorSpace),ce=f.colorSpace===Pn?null:ke.getPrimaries(f.colorSpace),pe=f.colorSpace===Pn||$===ce?i.NONE:i.BROWSER_DEFAULT_WEBGL;t.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,f.flipY),t.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,f.premultiplyAlpha),t.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,pe)}t.pixelStorei(i.UNPACK_ALIGNMENT,f.unpackAlignment);let J=m(f.image,!1,s.maxTextureSize);J=Mt(f,J);const ae=r.convert(f.format,f.colorSpace),Ee=r.convert(f.type);let de=M(f.internalFormat,ae,Ee,f.normalized,f.colorSpace,f.isVideoTexture);Ge(H,f);let oe;const ye=f.mipmaps,Ce=f.isVideoTexture!==!0,Le=re.__version===void 0||Y===!0,N=se.dataReady,le=E(f,J);if(f.isDepthTexture)de=T(f.format===zn,f.type),Le&&(Ce?t.texStorage2D(i.TEXTURE_2D,1,de,J.width,J.height):t.texImage2D(i.TEXTURE_2D,0,de,J.width,J.height,0,ae,Ee,null));else if(f.isDataTexture)if(ye.length>0){Ce&&Le&&t.texStorage2D(i.TEXTURE_2D,le,de,ye[0].width,ye[0].height);for(let $=0,ce=ye.length;$<ce;$++)oe=ye[$],Ce?N&&t.texSubImage2D(i.TEXTURE_2D,$,0,0,oe.width,oe.height,ae,Ee,oe.data):t.texImage2D(i.TEXTURE_2D,$,de,oe.width,oe.height,0,ae,Ee,oe.data);f.generateMipmaps=!1}else Ce?(Le&&t.texStorage2D(i.TEXTURE_2D,le,de,J.width,J.height),N&&ee(f,J,ae,Ee)):t.texImage2D(i.TEXTURE_2D,0,de,J.width,J.height,0,ae,Ee,J.data);else if(f.isCompressedTexture)if(f.isCompressedArrayTexture){Ce&&Le&&t.texStorage3D(i.TEXTURE_2D_ARRAY,le,de,ye[0].width,ye[0].height,J.depth);for(let $=0,ce=ye.length;$<ce;$++)if(oe=ye[$],f.format!==qt)if(ae!==null)if(Ce){if(N)if(f.layerUpdates.size>0){const pe=ja(oe.width,oe.height,f.format,f.type);for(const ie of f.layerUpdates){const we=oe.data.subarray(ie*pe/oe.data.BYTES_PER_ELEMENT,(ie+1)*pe/oe.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,$,0,0,ie,oe.width,oe.height,1,ae,we)}}else t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,$,0,0,0,oe.width,oe.height,J.depth,ae,oe.data)}else t.compressedTexImage3D(i.TEXTURE_2D_ARRAY,$,de,oe.width,oe.height,J.depth,0,oe.data,0,0);else Re("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Ce?N&&t.texSubImage3D(i.TEXTURE_2D_ARRAY,$,0,0,0,oe.width,oe.height,J.depth,ae,Ee,oe.data):t.texImage3D(i.TEXTURE_2D_ARRAY,$,de,oe.width,oe.height,J.depth,0,ae,Ee,oe.data);f.layerUpdates.size>0&&f.clearLayerUpdates()}else{Ce&&Le&&t.texStorage2D(i.TEXTURE_2D,le,de,ye[0].width,ye[0].height);for(let $=0,ce=ye.length;$<ce;$++)oe=ye[$],f.format!==qt?ae!==null?Ce?N&&t.compressedTexSubImage2D(i.TEXTURE_2D,$,0,0,oe.width,oe.height,ae,oe.data):t.compressedTexImage2D(i.TEXTURE_2D,$,de,oe.width,oe.height,0,oe.data):Re("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Ce?N&&t.texSubImage2D(i.TEXTURE_2D,$,0,0,oe.width,oe.height,ae,Ee,oe.data):t.texImage2D(i.TEXTURE_2D,$,de,oe.width,oe.height,0,ae,Ee,oe.data)}else if(f.isDataArrayTexture)if(Ce){if(Le&&t.texStorage3D(i.TEXTURE_2D_ARRAY,le,de,J.width,J.height,J.depth),N)if(f.layerUpdates.size>0){const $=ja(J.width,J.height,f.format,f.type);for(const ce of f.layerUpdates){const pe=J.data.subarray(ce*$/J.data.BYTES_PER_ELEMENT,(ce+1)*$/J.data.BYTES_PER_ELEMENT);t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,ce,J.width,J.height,1,ae,Ee,pe)}f.clearLayerUpdates()}else t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,J.width,J.height,J.depth,ae,Ee,J.data)}else t.texImage3D(i.TEXTURE_2D_ARRAY,0,de,J.width,J.height,J.depth,0,ae,Ee,J.data);else if(f.isData3DTexture)Ce?(Le&&t.texStorage3D(i.TEXTURE_3D,le,de,J.width,J.height,J.depth),N&&t.texSubImage3D(i.TEXTURE_3D,0,0,0,0,J.width,J.height,J.depth,ae,Ee,J.data)):t.texImage3D(i.TEXTURE_3D,0,de,J.width,J.height,J.depth,0,ae,Ee,J.data);else if(f.isFramebufferTexture){if(Le)if(Ce)t.texStorage2D(i.TEXTURE_2D,le,de,J.width,J.height);else{let $=J.width,ce=J.height;for(let pe=0;pe<le;pe++)t.texImage2D(i.TEXTURE_2D,pe,de,$,ce,0,ae,Ee,null),$>>=1,ce>>=1}}else if(f.isHTMLTexture){if("texElementImage2D"in i){const $=i.canvas;if($.hasAttribute("layoutsubtree")||$.setAttribute("layoutsubtree","true"),J.parentNode!==$){$.appendChild(J),p.add(f),$.onpaint=ce=>{const pe=ce.changedElements;for(const ie of p)pe.includes(ie.image)&&(ie.needsUpdate=!0)},$.requestPaint();return}if(i.texElementImage2D.length===3)i.texElementImage2D(i.TEXTURE_2D,i.RGBA8,J);else{const pe=i.RGBA,ie=i.RGBA,we=i.UNSIGNED_BYTE;i.texElementImage2D(i.TEXTURE_2D,0,pe,ie,we,J)}i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MIN_FILTER,i.LINEAR),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE)}}else if(ye.length>0){if(Ce&&Le){const $=Ze(ye[0]);t.texStorage2D(i.TEXTURE_2D,le,de,$.width,$.height)}for(let $=0,ce=ye.length;$<ce;$++)oe=ye[$],Ce?N&&t.texSubImage2D(i.TEXTURE_2D,$,0,0,ae,Ee,oe):t.texImage2D(i.TEXTURE_2D,$,de,ae,Ee,oe);f.generateMipmaps=!1}else if(Ce){if(Le){const $=Ze(J);t.texStorage2D(i.TEXTURE_2D,le,de,$.width,$.height)}N&&t.texSubImage2D(i.TEXTURE_2D,0,0,0,ae,Ee,J)}else t.texImage2D(i.TEXTURE_2D,0,de,ae,Ee,J);h(f)&&A(H),re.__version=se.version,f.onUpdate&&f.onUpdate(f)}y.__version=f.version}function Pe(y,f,F){if(f.image.length!==6)return;const H=Ye(y,f),Y=f.source;t.bindTexture(i.TEXTURE_CUBE_MAP,y.__webglTexture,i.TEXTURE0+F);const se=n.get(Y);if(Y.version!==se.__version||H===!0){t.activeTexture(i.TEXTURE0+F);const re=ke.getPrimaries(ke.workingColorSpace),Z=f.colorSpace===Pn?null:ke.getPrimaries(f.colorSpace),J=f.colorSpace===Pn||re===Z?i.NONE:i.BROWSER_DEFAULT_WEBGL;t.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,f.flipY),t.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,f.premultiplyAlpha),t.pixelStorei(i.UNPACK_ALIGNMENT,f.unpackAlignment),t.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,J);const ae=f.isCompressedTexture||f.image[0].isCompressedTexture,Ee=f.image[0]&&f.image[0].isDataTexture,de=[];for(let ie=0;ie<6;ie++)!ae&&!Ee?de[ie]=m(f.image[ie],!0,s.maxCubemapSize):de[ie]=Ee?f.image[ie].image:f.image[ie],de[ie]=Mt(f,de[ie]);const oe=de[0],ye=r.convert(f.format,f.colorSpace),Ce=r.convert(f.type),Le=M(f.internalFormat,ye,Ce,f.normalized,f.colorSpace),N=f.isVideoTexture!==!0,le=se.__version===void 0||H===!0,$=Y.dataReady;let ce=E(f,oe);Ge(i.TEXTURE_CUBE_MAP,f);let pe;if(ae){N&&le&&t.texStorage2D(i.TEXTURE_CUBE_MAP,ce,Le,oe.width,oe.height);for(let ie=0;ie<6;ie++){pe=de[ie].mipmaps;for(let we=0;we<pe.length;we++){const Me=pe[we];f.format!==qt?ye!==null?N?$&&t.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ie,we,0,0,Me.width,Me.height,ye,Me.data):t.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ie,we,Le,Me.width,Me.height,0,Me.data):Re("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):N?$&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ie,we,0,0,Me.width,Me.height,ye,Ce,Me.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ie,we,Le,Me.width,Me.height,0,ye,Ce,Me.data)}}}else{if(pe=f.mipmaps,N&&le){pe.length>0&&ce++;const ie=Ze(de[0]);t.texStorage2D(i.TEXTURE_CUBE_MAP,ce,Le,ie.width,ie.height)}for(let ie=0;ie<6;ie++)if(Ee){N?$&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ie,0,0,0,de[ie].width,de[ie].height,ye,Ce,de[ie].data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ie,0,Le,de[ie].width,de[ie].height,0,ye,Ce,de[ie].data);for(let we=0;we<pe.length;we++){const nt=pe[we].image[ie].image;N?$&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ie,we+1,0,0,nt.width,nt.height,ye,Ce,nt.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ie,we+1,Le,nt.width,nt.height,0,ye,Ce,nt.data)}}else{N?$&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ie,0,0,0,ye,Ce,de[ie]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ie,0,Le,ye,Ce,de[ie]);for(let we=0;we<pe.length;we++){const Me=pe[we];N?$&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ie,we+1,0,0,ye,Ce,Me.image[ie]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ie,we+1,Le,ye,Ce,Me.image[ie])}}}h(f)&&A(i.TEXTURE_CUBE_MAP),se.__version=Y.version,f.onUpdate&&f.onUpdate(f)}y.__version=f.version}function ge(y,f,F,H,Y,se){const re=r.convert(F.format,F.colorSpace),Z=r.convert(F.type),J=M(F.internalFormat,re,Z,F.normalized,F.colorSpace),ae=n.get(f),Ee=n.get(F);if(Ee.__renderTarget=f,!ae.__hasExternalTextures){const de=Math.max(1,f.width>>se),oe=Math.max(1,f.height>>se);Y===i.TEXTURE_3D||Y===i.TEXTURE_2D_ARRAY?t.texImage3D(Y,se,J,de,oe,f.depth,0,re,Z,null):t.texImage2D(Y,se,J,de,oe,0,re,Z,null)}t.bindFramebuffer(i.FRAMEBUFFER,y),ut(f)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,H,Y,Ee.__webglTexture,0,lt(f)):(Y===i.TEXTURE_2D||Y>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&Y<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,H,Y,Ee.__webglTexture,se),t.bindFramebuffer(i.FRAMEBUFFER,null)}function Ue(y,f,F){if(i.bindRenderbuffer(i.RENDERBUFFER,y),f.depthBuffer){const H=f.depthTexture,Y=H&&H.isDepthTexture?H.type:null,se=T(f.stencilBuffer,Y),re=f.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;ut(f)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,lt(f),se,f.width,f.height):F?i.renderbufferStorageMultisample(i.RENDERBUFFER,lt(f),se,f.width,f.height):i.renderbufferStorage(i.RENDERBUFFER,se,f.width,f.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,re,i.RENDERBUFFER,y)}else{const H=f.textures;for(let Y=0;Y<H.length;Y++){const se=H[Y],re=r.convert(se.format,se.colorSpace),Z=r.convert(se.type),J=M(se.internalFormat,re,Z,se.normalized,se.colorSpace);ut(f)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,lt(f),J,f.width,f.height):F?i.renderbufferStorageMultisample(i.RENDERBUFFER,lt(f),J,f.width,f.height):i.renderbufferStorage(i.RENDERBUFFER,J,f.width,f.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function mt(y,f,F){const H=f.isWebGLCubeRenderTarget===!0;if(t.bindFramebuffer(i.FRAMEBUFFER,y),!(f.depthTexture&&f.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");const Y=n.get(f.depthTexture);if(Y.__renderTarget=f,(!Y.__webglTexture||f.depthTexture.image.width!==f.width||f.depthTexture.image.height!==f.height)&&(f.depthTexture.image.width=f.width,f.depthTexture.image.height=f.height,f.depthTexture.needsUpdate=!0),H){if(Y.__webglInit===void 0&&(Y.__webglInit=!0,f.depthTexture.addEventListener("dispose",C)),Y.__webglTexture===void 0){Y.__webglTexture=i.createTexture(),t.bindTexture(i.TEXTURE_CUBE_MAP,Y.__webglTexture),Ge(i.TEXTURE_CUBE_MAP,f.depthTexture);const ae=r.convert(f.depthTexture.format),Ee=r.convert(f.depthTexture.type);let de;f.depthTexture.format===vn?de=i.DEPTH_COMPONENT24:f.depthTexture.format===zn&&(de=i.DEPTH24_STENCIL8);for(let oe=0;oe<6;oe++)i.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+oe,0,de,f.width,f.height,0,ae,Ee,null)}}else ne(f.depthTexture,0);const se=Y.__webglTexture,re=lt(f),Z=H?i.TEXTURE_CUBE_MAP_POSITIVE_X+F:i.TEXTURE_2D,J=f.depthTexture.format===zn?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;if(f.depthTexture.format===vn)ut(f)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,J,Z,se,0,re):i.framebufferTexture2D(i.FRAMEBUFFER,J,Z,se,0);else if(f.depthTexture.format===zn)ut(f)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,J,Z,se,0,re):i.framebufferTexture2D(i.FRAMEBUFFER,J,Z,se,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function Oe(y){const f=n.get(y),F=y.isWebGLCubeRenderTarget===!0;if(f.__boundDepthTexture!==y.depthTexture){const H=y.depthTexture;if(f.__depthDisposeCallback&&f.__depthDisposeCallback(),H){const Y=()=>{delete f.__boundDepthTexture,delete f.__depthDisposeCallback,H.removeEventListener("dispose",Y)};H.addEventListener("dispose",Y),f.__depthDisposeCallback=Y}f.__boundDepthTexture=H}if(y.depthTexture&&!f.__autoAllocateDepthBuffer)if(F)for(let H=0;H<6;H++)mt(f.__webglFramebuffer[H],y,H);else{const H=y.texture.mipmaps;H&&H.length>0?mt(f.__webglFramebuffer[0],y,0):mt(f.__webglFramebuffer,y,0)}else if(F){f.__webglDepthbuffer=[];for(let H=0;H<6;H++)if(t.bindFramebuffer(i.FRAMEBUFFER,f.__webglFramebuffer[H]),f.__webglDepthbuffer[H]===void 0)f.__webglDepthbuffer[H]=i.createRenderbuffer(),Ue(f.__webglDepthbuffer[H],y,!1);else{const Y=y.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,se=f.__webglDepthbuffer[H];i.bindRenderbuffer(i.RENDERBUFFER,se),i.framebufferRenderbuffer(i.FRAMEBUFFER,Y,i.RENDERBUFFER,se)}}else{const H=y.texture.mipmaps;if(H&&H.length>0?t.bindFramebuffer(i.FRAMEBUFFER,f.__webglFramebuffer[0]):t.bindFramebuffer(i.FRAMEBUFFER,f.__webglFramebuffer),f.__webglDepthbuffer===void 0)f.__webglDepthbuffer=i.createRenderbuffer(),Ue(f.__webglDepthbuffer,y,!1);else{const Y=y.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,se=f.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,se),i.framebufferRenderbuffer(i.FRAMEBUFFER,Y,i.RENDERBUFFER,se)}}t.bindFramebuffer(i.FRAMEBUFFER,null)}function Xe(y,f,F){const H=n.get(y);f!==void 0&&ge(H.__webglFramebuffer,y,y.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),F!==void 0&&Oe(y)}function tt(y){const f=y.texture,F=n.get(y),H=n.get(f);y.addEventListener("dispose",v);const Y=y.textures,se=y.isWebGLCubeRenderTarget===!0,re=Y.length>1;if(re||(H.__webglTexture===void 0&&(H.__webglTexture=i.createTexture()),H.__version=f.version,a.memory.textures++),se){F.__webglFramebuffer=[];for(let Z=0;Z<6;Z++)if(f.mipmaps&&f.mipmaps.length>0){F.__webglFramebuffer[Z]=[];for(let J=0;J<f.mipmaps.length;J++)F.__webglFramebuffer[Z][J]=i.createFramebuffer()}else F.__webglFramebuffer[Z]=i.createFramebuffer()}else{if(f.mipmaps&&f.mipmaps.length>0){F.__webglFramebuffer=[];for(let Z=0;Z<f.mipmaps.length;Z++)F.__webglFramebuffer[Z]=i.createFramebuffer()}else F.__webglFramebuffer=i.createFramebuffer();if(re)for(let Z=0,J=Y.length;Z<J;Z++){const ae=n.get(Y[Z]);ae.__webglTexture===void 0&&(ae.__webglTexture=i.createTexture(),a.memory.textures++)}if(y.samples>0&&ut(y)===!1){F.__webglMultisampledFramebuffer=i.createFramebuffer(),F.__webglColorRenderbuffer=[],t.bindFramebuffer(i.FRAMEBUFFER,F.__webglMultisampledFramebuffer);for(let Z=0;Z<Y.length;Z++){const J=Y[Z];F.__webglColorRenderbuffer[Z]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,F.__webglColorRenderbuffer[Z]);const ae=r.convert(J.format,J.colorSpace),Ee=r.convert(J.type),de=M(J.internalFormat,ae,Ee,J.normalized,J.colorSpace,y.isXRRenderTarget===!0),oe=lt(y);i.renderbufferStorageMultisample(i.RENDERBUFFER,oe,de,y.width,y.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+Z,i.RENDERBUFFER,F.__webglColorRenderbuffer[Z])}i.bindRenderbuffer(i.RENDERBUFFER,null),y.depthBuffer&&(F.__webglDepthRenderbuffer=i.createRenderbuffer(),Ue(F.__webglDepthRenderbuffer,y,!0)),t.bindFramebuffer(i.FRAMEBUFFER,null)}}if(se){t.bindTexture(i.TEXTURE_CUBE_MAP,H.__webglTexture),Ge(i.TEXTURE_CUBE_MAP,f);for(let Z=0;Z<6;Z++)if(f.mipmaps&&f.mipmaps.length>0)for(let J=0;J<f.mipmaps.length;J++)ge(F.__webglFramebuffer[Z][J],y,f,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+Z,J);else ge(F.__webglFramebuffer[Z],y,f,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+Z,0);h(f)&&A(i.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(re){for(let Z=0,J=Y.length;Z<J;Z++){const ae=Y[Z],Ee=n.get(ae);let de=i.TEXTURE_2D;(y.isWebGL3DRenderTarget||y.isWebGLArrayRenderTarget)&&(de=y.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(de,Ee.__webglTexture),Ge(de,ae),ge(F.__webglFramebuffer,y,ae,i.COLOR_ATTACHMENT0+Z,de,0),h(ae)&&A(de)}t.unbindTexture()}else{let Z=i.TEXTURE_2D;if((y.isWebGL3DRenderTarget||y.isWebGLArrayRenderTarget)&&(Z=y.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(Z,H.__webglTexture),Ge(Z,f),f.mipmaps&&f.mipmaps.length>0)for(let J=0;J<f.mipmaps.length;J++)ge(F.__webglFramebuffer[J],y,f,i.COLOR_ATTACHMENT0,Z,J);else ge(F.__webglFramebuffer,y,f,i.COLOR_ATTACHMENT0,Z,0);h(f)&&A(Z),t.unbindTexture()}y.depthBuffer&&Oe(y)}function ze(y){const f=y.textures;for(let F=0,H=f.length;F<H;F++){const Y=f[F];if(h(Y)){const se=P(y),re=n.get(Y).__webglTexture;t.bindTexture(se,re),A(se),t.unbindTexture()}}}const rt=[],_t=[];function Pt(y){if(y.samples>0){if(ut(y)===!1){const f=y.textures,F=y.width,H=y.height;let Y=i.COLOR_BUFFER_BIT;const se=y.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,re=n.get(y),Z=f.length>1;if(Z)for(let ae=0;ae<f.length;ae++)t.bindFramebuffer(i.FRAMEBUFFER,re.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+ae,i.RENDERBUFFER,null),t.bindFramebuffer(i.FRAMEBUFFER,re.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+ae,i.TEXTURE_2D,null,0);t.bindFramebuffer(i.READ_FRAMEBUFFER,re.__webglMultisampledFramebuffer);const J=y.texture.mipmaps;J&&J.length>0?t.bindFramebuffer(i.DRAW_FRAMEBUFFER,re.__webglFramebuffer[0]):t.bindFramebuffer(i.DRAW_FRAMEBUFFER,re.__webglFramebuffer);for(let ae=0;ae<f.length;ae++){if(y.resolveDepthBuffer&&(y.depthBuffer&&(Y|=i.DEPTH_BUFFER_BIT),y.stencilBuffer&&y.resolveStencilBuffer&&(Y|=i.STENCIL_BUFFER_BIT)),Z){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,re.__webglColorRenderbuffer[ae]);const Ee=n.get(f[ae]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,Ee,0)}i.blitFramebuffer(0,0,F,H,0,0,F,H,Y,i.NEAREST),l===!0&&(rt.length=0,_t.length=0,rt.push(i.COLOR_ATTACHMENT0+ae),y.depthBuffer&&y.storeMultisampledDepthBuffer===!1&&(rt.push(se),_t.push(se),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,_t)),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,rt))}if(t.bindFramebuffer(i.READ_FRAMEBUFFER,null),t.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),Z)for(let ae=0;ae<f.length;ae++){t.bindFramebuffer(i.FRAMEBUFFER,re.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+ae,i.RENDERBUFFER,re.__webglColorRenderbuffer[ae]);const Ee=n.get(f[ae]).__webglTexture;t.bindFramebuffer(i.FRAMEBUFFER,re.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+ae,i.TEXTURE_2D,Ee,0)}t.bindFramebuffer(i.DRAW_FRAMEBUFFER,re.__webglMultisampledFramebuffer)}else if(y.depthBuffer&&y.storeMultisampledDepthBuffer===!1&&l){const f=y.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[f])}}}function lt(y){return Math.min(s.maxSamples,y.samples)}function ut(y){const f=n.get(y);return y.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&f.__useRenderToTexture!==!1}function L(y){const f=a.render.frame;u.get(y)!==f&&(u.set(y,f),y.update())}function Mt(y,f){const F=y.colorSpace,H=y.format,Y=y.type;return y.isCompressedTexture===!0||y.isVideoTexture===!0||F!==ms&&F!==Pn&&(ke.getTransfer(F)===$e?(H!==qt||Y!==Ot)&&Re("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):qe("WebGLTextures: Unsupported texture color space:",F)),f}function Ze(y){return typeof HTMLImageElement<"u"&&y instanceof HTMLImageElement?(c.width=y.naturalWidth||y.width,c.height=y.naturalHeight||y.height):typeof VideoFrame<"u"&&y instanceof VideoFrame?(c.width=y.displayWidth,c.height=y.displayHeight):(c.width=y.width,c.height=y.height),c}this.allocateTextureUnit=j,this.resetTextureUnits=W,this.getTextureUnits=I,this.setTextureUnits=O,this.setTexture2D=ne,this.setTexture2DArray=q,this.setTexture3D=Q,this.setTextureCube=te,this.rebindTextures=Xe,this.setupRenderTarget=tt,this.updateRenderTargetMipmap=ze,this.updateMultisampleRenderTarget=Pt,this.setupDepthRenderbuffer=Oe,this.setupFrameBufferTexture=ge,this.useMultisampledRTT=ut,this.isReversedDepthBuffer=function(){return t.buffers.depth.getReversed()}}function am(i,e){function t(n,s=Pn){let r;const a=ke.getTransfer(s);if(n===Ot)return i.UNSIGNED_BYTE;if(n===Jr)return i.UNSIGNED_SHORT_4_4_4_4;if(n===Qr)return i.UNSIGNED_SHORT_5_5_5_1;if(n===Oo)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===Bo)return i.UNSIGNED_INT_10F_11F_11F_REV;if(n===Uo)return i.BYTE;if(n===Fo)return i.SHORT;if(n===Ti)return i.UNSIGNED_SHORT;if(n===$r)return i.INT;if(n===rn)return i.UNSIGNED_INT;if(n===tn)return i.FLOAT;if(n===an)return i.HALF_FLOAT;if(n===zo)return i.ALPHA;if(n===ko)return i.RGB;if(n===qt)return i.RGBA;if(n===vn)return i.DEPTH_COMPONENT;if(n===zn)return i.DEPTH_STENCIL;if(n===Ho)return i.RED;if(n===ea)return i.RED_INTEGER;if(n===Gn)return i.RG;if(n===ta)return i.RG_INTEGER;if(n===na)return i.RGBA_INTEGER;if(n===ls||n===cs||n===ds||n===hs)if(a===$e)if(r=e.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===ls)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===cs)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===ds)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===hs)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=e.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===ls)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===cs)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===ds)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===hs)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===fr||n===pr||n===mr||n===gr)if(r=e.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===fr)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===pr)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===mr)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===gr)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===xr||n===_r||n===vr||n===Sr||n===Mr||n===fs||n===br)if(r=e.get("WEBGL_compressed_texture_etc"),r!==null){if(n===xr||n===_r)return a===$e?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===vr)return a===$e?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC;if(n===Sr)return r.COMPRESSED_R11_EAC;if(n===Mr)return r.COMPRESSED_SIGNED_R11_EAC;if(n===fs)return r.COMPRESSED_RG11_EAC;if(n===br)return r.COMPRESSED_SIGNED_RG11_EAC}else return null;if(n===Er||n===yr||n===Tr||n===wr||n===Ar||n===Cr||n===Rr||n===Pr||n===Nr||n===Lr||n===Dr||n===Ir||n===Ur||n===Fr)if(r=e.get("WEBGL_compressed_texture_astc"),r!==null){if(n===Er)return a===$e?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===yr)return a===$e?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===Tr)return a===$e?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===wr)return a===$e?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===Ar)return a===$e?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===Cr)return a===$e?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===Rr)return a===$e?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===Pr)return a===$e?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===Nr)return a===$e?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===Lr)return a===$e?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===Dr)return a===$e?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===Ir)return a===$e?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===Ur)return a===$e?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===Fr)return a===$e?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===Or||n===Br||n===zr)if(r=e.get("EXT_texture_compression_bptc"),r!==null){if(n===Or)return a===$e?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===Br)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===zr)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===kr||n===Hr||n===ps||n===Gr)if(r=e.get("EXT_texture_compression_rgtc"),r!==null){if(n===kr)return r.COMPRESSED_RED_RGTC1_EXT;if(n===Hr)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===ps)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===Gr)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===wi?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:t}}const om=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,lm=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class cm{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){const n=new Jo(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){const t=e.cameras[0].viewport,n=new ln({vertexShader:om,fragmentShader:lm,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new on(new Di(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class dm extends Vn{constructor(e,t){super();const n=this;let s=null,r=1,a=null,o="local-floor",l=1,c=null,u=null,p=null,d=null,g=null,x=null;const b=typeof XRWebGLBinding<"u",m=new cm,h={},A=t.getContextAttributes();let P=null,M=null;const T=[],E=[],C=new Ve;let v=null,w=null;const D=new Ut;D.viewport=new dt;const U=new Ut;U.viewport=new dt;const k=[D,U],W=new gd;let I=null,O=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(K){let ee=T[K];return ee===void 0&&(ee=new Us,T[K]=ee),ee.getTargetRaySpace()},this.getControllerGrip=function(K){let ee=T[K];return ee===void 0&&(ee=new Us,T[K]=ee),ee.getGripSpace()},this.getHand=function(K){let ee=T[K];return ee===void 0&&(ee=new Us,T[K]=ee),ee.getHandSpace()};function j(K){const ee=E.indexOf(K.inputSource);if(ee===-1)return;const _e=T[ee];_e!==void 0&&(_e.update(K.inputSource,K.frame,c||a),_e.dispatchEvent({type:K.type,data:K.inputSource}))}function X(){s.removeEventListener("select",j),s.removeEventListener("selectstart",j),s.removeEventListener("selectend",j),s.removeEventListener("squeeze",j),s.removeEventListener("squeezestart",j),s.removeEventListener("squeezeend",j),s.removeEventListener("end",X),s.removeEventListener("inputsourceschange",ne);for(let K=0;K<T.length;K++){const ee=E[K];ee!==null&&(E[K]=null,T[K].disconnect(ee))}I=null,O=null,m.reset();for(const K in h)delete h[K];if(e.setRenderTarget(P),g=null,d=null,p=null,s=null,M=null,Ye.stop(),n.isPresenting=!1,e.setPixelRatio(v),e.setSize(C.width,C.height,!1),w!==null){const K=w.camera;K.fov=w.fov,K.zoom=w.zoom,K.updateProjectionMatrix(),w=null}n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(K){r=K,n.isPresenting===!0&&Re("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(K){o=K,n.isPresenting===!0&&Re("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(K){c=K},this.getBaseLayer=function(){return d!==null?d:g},this.getBinding=function(){return p===null&&b&&(p=new XRWebGLBinding(s,t)),p},this.getFrame=function(){return x},this.getSession=function(){return s},this.setSession=async function(K){if(s=K,s!==null){if(P=e.getRenderTarget(),s.addEventListener("select",j),s.addEventListener("selectstart",j),s.addEventListener("selectend",j),s.addEventListener("squeeze",j),s.addEventListener("squeezestart",j),s.addEventListener("squeezeend",j),s.addEventListener("end",X),s.addEventListener("inputsourceschange",ne),A.xrCompatible!==!0&&await t.makeXRCompatible(),v=e.getPixelRatio(),e.getSize(C),b&&"createProjectionLayer"in XRWebGLBinding.prototype){let _e=null,Pe=null,ge=null;A.depth&&(ge=A.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,_e=A.stencil?zn:vn,Pe=A.stencil?wi:rn);const Ue={colorFormat:t.RGBA8,depthFormat:ge,scaleFactor:r};p=this.getBinding(),d=p.createProjectionLayer(Ue),s.updateRenderState({layers:[d]}),e.setPixelRatio(1),e.setSize(d.textureWidth,d.textureHeight,!1),M=new Yt(d.textureWidth,d.textureHeight,{format:qt,type:Ot,depthTexture:new Ci(d.textureWidth,d.textureHeight,Pe,void 0,void 0,void 0,void 0,void 0,void 0,_e),stencilBuffer:A.stencil,colorSpace:e.outputColorSpace,samples:A.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1,storeMultisampledDepthBuffer:d.ignoreDepthValues===!1,storeMultisampledStencilBuffer:d.ignoreDepthValues===!1})}else{const _e={antialias:A.antialias,alpha:!0,depth:A.depth,stencil:A.stencil,framebufferScaleFactor:r};g=new XRWebGLLayer(s,t,_e),s.updateRenderState({baseLayer:g}),e.setPixelRatio(1),e.setSize(g.framebufferWidth,g.framebufferHeight,!1),M=new Yt(g.framebufferWidth,g.framebufferHeight,{format:qt,type:Ot,colorSpace:e.outputColorSpace,stencilBuffer:A.stencil,resolveDepthBuffer:g.ignoreDepthValues===!1,resolveStencilBuffer:g.ignoreDepthValues===!1,storeMultisampledDepthBuffer:g.ignoreDepthValues===!1,storeMultisampledStencilBuffer:g.ignoreDepthValues===!1})}M.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await s.requestReferenceSpace(o),Ye.setContext(s),Ye.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return m.getDepthTexture()};function ne(K){for(let ee=0;ee<K.removed.length;ee++){const _e=K.removed[ee],Pe=E.indexOf(_e);Pe>=0&&(E[Pe]=null,T[Pe].disconnect(_e))}for(let ee=0;ee<K.added.length;ee++){const _e=K.added[ee];let Pe=E.indexOf(_e);if(Pe===-1){for(let Ue=0;Ue<T.length;Ue++)if(Ue>=E.length){E.push(_e),Pe=Ue;break}else if(E[Ue]===null){E[Ue]=_e,Pe=Ue;break}if(Pe===-1)break}const ge=T[Pe];ge&&ge.connect(_e)}}const q=new G,Q=new G;function te(K,ee,_e){q.setFromMatrixPosition(ee.matrixWorld),Q.setFromMatrixPosition(_e.matrixWorld);const Pe=q.distanceTo(Q),ge=ee.projectionMatrix.elements,Ue=_e.projectionMatrix.elements,mt=ge[14]/(ge[10]-1),Oe=ge[14]/(ge[10]+1),Xe=(ge[9]+1)/ge[5],tt=(ge[9]-1)/ge[5],ze=(ge[8]-1)/ge[0],rt=(Ue[8]+1)/Ue[0],_t=mt*ze,Pt=mt*rt,lt=Pe/(-ze+rt),ut=lt*-ze;if(ee.matrixWorld.decompose(K.position,K.quaternion,K.scale),K.translateX(ut),K.translateZ(lt),K.matrixWorld.compose(K.position,K.quaternion,K.scale),K.matrixWorldInverse.copy(K.matrixWorld).invert(),ge[10]===-1)K.projectionMatrix.copy(ee.projectionMatrix),K.projectionMatrixInverse.copy(ee.projectionMatrixInverse);else{const L=mt+lt,Mt=Oe+lt,Ze=_t-ut,y=Pt+(Pe-ut),f=Xe*Oe/Mt*L,F=tt*Oe/Mt*L;K.projectionMatrix.makePerspective(Ze,y,f,F,L,Mt),K.projectionMatrixInverse.copy(K.projectionMatrix).invert()}}function Ae(K,ee){ee===null?K.matrixWorld.copy(K.matrix):K.matrixWorld.multiplyMatrices(ee.matrixWorld,K.matrix),K.matrixWorldInverse.copy(K.matrixWorld).invert()}this.updateCamera=function(K){if(s===null)return;let ee=K.near,_e=K.far;m.texture!==null&&(m.depthNear>0&&(ee=m.depthNear),m.depthFar>0&&(_e=m.depthFar)),W.near=U.near=D.near=ee,W.far=U.far=D.far=_e,(I!==W.near||O!==W.far)&&(s.updateRenderState({depthNear:W.near,depthFar:W.far}),I=W.near,O=W.far),W.layers.mask=K.layers.mask|6,D.layers.mask=W.layers.mask&-5,U.layers.mask=W.layers.mask&-3;const Pe=K.parent,ge=W.cameras;Ae(W,Pe);for(let Ue=0;Ue<ge.length;Ue++)Ae(ge[Ue],Pe);ge.length===2?te(W,D,U):W.projectionMatrix.copy(D.projectionMatrix),w===null&&K.isPerspectiveCamera&&(w={camera:K,fov:K.fov,zoom:K.zoom}),Te(K,W,Pe)};function Te(K,ee,_e){_e===null?K.matrix.copy(ee.matrixWorld):(K.matrix.copy(_e.matrixWorld),K.matrix.invert(),K.matrix.multiply(ee.matrixWorld)),K.matrix.decompose(K.position,K.quaternion,K.scale),K.updateMatrixWorld(!0),K.projectionMatrix.copy(ee.projectionMatrix),K.projectionMatrixInverse.copy(ee.projectionMatrixInverse),K.isPerspectiveCamera&&(K.fov=Wr*2*Math.atan(1/K.projectionMatrix.elements[5]),K.zoom=1)}this.getCamera=function(){return W},this.getFoveation=function(){if(!(d===null&&g===null))return l},this.setFoveation=function(K){l=K,d!==null&&(d.fixedFoveation=K),g!==null&&g.fixedFoveation!==void 0&&(g.fixedFoveation=K)},this.hasDepthSensing=function(){return m.texture!==null},this.getDepthSensingMesh=function(){return m.getMesh(W)},this.getCameraTexture=function(K){return h[K]};let et=null;function Ge(K,ee){if(u=ee.getViewerPose(c||a),x=ee,u!==null){const _e=u.views;g!==null&&(e.setRenderTargetFramebuffer(M,g.framebuffer),e.setRenderTarget(M));let Pe=!1;_e.length!==W.cameras.length&&(W.cameras.length=0,Pe=!0);for(let Oe=0;Oe<_e.length;Oe++){const Xe=_e[Oe];let tt=null;if(g!==null)tt=g.getViewport(Xe);else{const rt=p.getViewSubImage(d,Xe);tt=rt.viewport,Oe===0&&(e.setRenderTargetTextures(M,rt.colorTexture,rt.depthStencilTexture),e.setRenderTarget(M))}let ze=k[Oe];ze===void 0&&(ze=new Ut,ze.layers.enable(Oe),ze.viewport=new dt,k[Oe]=ze),ze.matrix.fromArray(Xe.transform.matrix),ze.matrix.decompose(ze.position,ze.quaternion,ze.scale),ze.projectionMatrix.fromArray(Xe.projectionMatrix),ze.projectionMatrixInverse.copy(ze.projectionMatrix).invert(),ze.viewport.set(tt.x,tt.y,tt.width,tt.height),Oe===0&&(W.matrix.copy(ze.matrix),W.matrix.decompose(W.position,W.quaternion,W.scale)),Pe===!0&&W.cameras.push(ze)}const ge=s.enabledFeatures;if(ge&&ge.includes("depth-sensing")&&s.depthUsage=="gpu-optimized"&&b){p=n.getBinding();const Oe=p.getDepthInformation(_e[0]);Oe&&Oe.isValid&&Oe.texture&&m.init(Oe,s.renderState)}if(ge&&ge.includes("camera-access")&&b){e.state.unbindTexture(),p=n.getBinding();for(let Oe=0;Oe<_e.length;Oe++){const Xe=_e[Oe].camera;if(Xe){let tt=h[Xe];tt||(tt=new Jo,h[Xe]=tt);const ze=p.getCameraImage(Xe);tt.sourceTexture=ze}}}}for(let _e=0;_e<T.length;_e++){const Pe=E[_e],ge=T[_e];Pe!==null&&ge!==void 0&&ge.update(Pe,ee,c||a)}et&&et(K,ee),ee.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:ee}),x=null}const Ye=new sl;Ye.setAnimationLoop(Ge),this.setAnimationLoop=function(K){et=K},this.dispose=function(){}}}const hm=new ot,hl=new Ne;hl.set(-1,0,0,0,1,0,0,0,1);function um(i,e){function t(m,h){m.matrixAutoUpdate===!0&&m.updateMatrix(),h.value.copy(m.matrix)}function n(m,h){h.color.getRGB(m.fogColor.value,Qo(i)),h.isFog?(m.fogNear.value=h.near,m.fogFar.value=h.far):h.isFogExp2&&(m.fogDensity.value=h.density)}function s(m,h,A,P,M){h.isNodeMaterial?h.uniformsNeedUpdate=!1:h.isMeshBasicMaterial?r(m,h):h.isMeshLambertMaterial?(r(m,h),h.envMap&&(m.envMapIntensity.value=h.envMapIntensity)):h.isMeshToonMaterial?(r(m,h),p(m,h)):h.isMeshPhongMaterial?(r(m,h),u(m,h),h.envMap&&(m.envMapIntensity.value=h.envMapIntensity)):h.isMeshStandardMaterial?(r(m,h),d(m,h),h.isMeshPhysicalMaterial&&g(m,h,M)):h.isMeshMatcapMaterial?(r(m,h),x(m,h)):h.isMeshDepthMaterial?r(m,h):h.isMeshDistanceMaterial?(r(m,h),b(m,h)):h.isMeshNormalMaterial?r(m,h):h.isLineBasicMaterial?(a(m,h),h.isLineDashedMaterial&&o(m,h)):h.isPointsMaterial?l(m,h,A,P):h.isSpriteMaterial?c(m,h):h.isShadowMaterial?(m.color.value.copy(h.color),m.opacity.value=h.opacity):h.isShaderMaterial&&(h.uniformsNeedUpdate=!1)}function r(m,h){m.opacity.value=h.opacity,h.color&&m.diffuse.value.copy(h.color),h.emissive&&m.emissive.value.copy(h.emissive).multiplyScalar(h.emissiveIntensity),h.map&&(m.map.value=h.map,t(h.map,m.mapTransform)),h.alphaMap&&(m.alphaMap.value=h.alphaMap,t(h.alphaMap,m.alphaMapTransform)),h.bumpMap&&(m.bumpMap.value=h.bumpMap,t(h.bumpMap,m.bumpMapTransform),m.bumpScale.value=h.bumpScale,h.side===Lt&&(m.bumpScale.value*=-1)),h.normalMap&&(m.normalMap.value=h.normalMap,t(h.normalMap,m.normalMapTransform),m.normalScale.value.copy(h.normalScale),h.side===Lt&&m.normalScale.value.negate()),h.displacementMap&&(m.displacementMap.value=h.displacementMap,t(h.displacementMap,m.displacementMapTransform),m.displacementScale.value=h.displacementScale,m.displacementBias.value=h.displacementBias),h.emissiveMap&&(m.emissiveMap.value=h.emissiveMap,t(h.emissiveMap,m.emissiveMapTransform)),h.specularMap&&(m.specularMap.value=h.specularMap,t(h.specularMap,m.specularMapTransform)),h.alphaTest>0&&(m.alphaTest.value=h.alphaTest);const A=e.get(h),P=A.envMap,M=A.envMapRotation;P&&(m.envMap.value=P,m.envMapRotation.value.setFromMatrix4(hm.makeRotationFromEuler(M)).transpose(),P.isCubeTexture&&P.isRenderTargetTexture===!1&&m.envMapRotation.value.premultiply(hl),m.reflectivity.value=h.reflectivity,m.ior.value=h.ior,m.refractionRatio.value=h.refractionRatio),h.lightMap&&(m.lightMap.value=h.lightMap,m.lightMapIntensity.value=h.lightMapIntensity,t(h.lightMap,m.lightMapTransform)),h.aoMap&&(m.aoMap.value=h.aoMap,m.aoMapIntensity.value=h.aoMapIntensity,t(h.aoMap,m.aoMapTransform))}function a(m,h){m.diffuse.value.copy(h.color),m.opacity.value=h.opacity,h.map&&(m.map.value=h.map,t(h.map,m.mapTransform))}function o(m,h){m.dashSize.value=h.dashSize,m.totalSize.value=h.dashSize+h.gapSize,m.scale.value=h.scale}function l(m,h,A,P){m.diffuse.value.copy(h.color),m.opacity.value=h.opacity,m.size.value=h.size*A,m.scale.value=P*.5,h.map&&(m.map.value=h.map,t(h.map,m.uvTransform)),h.alphaMap&&(m.alphaMap.value=h.alphaMap,t(h.alphaMap,m.alphaMapTransform)),h.alphaTest>0&&(m.alphaTest.value=h.alphaTest)}function c(m,h){m.diffuse.value.copy(h.color),m.opacity.value=h.opacity,m.rotation.value=h.rotation,h.map&&(m.map.value=h.map,t(h.map,m.mapTransform)),h.alphaMap&&(m.alphaMap.value=h.alphaMap,t(h.alphaMap,m.alphaMapTransform)),h.alphaTest>0&&(m.alphaTest.value=h.alphaTest)}function u(m,h){m.specular.value.copy(h.specular),m.shininess.value=Math.max(h.shininess,1e-4)}function p(m,h){h.gradientMap&&(m.gradientMap.value=h.gradientMap)}function d(m,h){m.metalness.value=h.metalness,h.metalnessMap&&(m.metalnessMap.value=h.metalnessMap,t(h.metalnessMap,m.metalnessMapTransform)),m.roughness.value=h.roughness,h.roughnessMap&&(m.roughnessMap.value=h.roughnessMap,t(h.roughnessMap,m.roughnessMapTransform)),h.envMap&&(m.envMapIntensity.value=h.envMapIntensity)}function g(m,h,A){m.ior.value=h.ior,h.sheen>0&&(m.sheenColor.value.copy(h.sheenColor).multiplyScalar(h.sheen),m.sheenRoughness.value=h.sheenRoughness,h.sheenColorMap&&(m.sheenColorMap.value=h.sheenColorMap,t(h.sheenColorMap,m.sheenColorMapTransform)),h.sheenRoughnessMap&&(m.sheenRoughnessMap.value=h.sheenRoughnessMap,t(h.sheenRoughnessMap,m.sheenRoughnessMapTransform))),h.clearcoat>0&&(m.clearcoat.value=h.clearcoat,m.clearcoatRoughness.value=h.clearcoatRoughness,h.clearcoatMap&&(m.clearcoatMap.value=h.clearcoatMap,t(h.clearcoatMap,m.clearcoatMapTransform)),h.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=h.clearcoatRoughnessMap,t(h.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),h.clearcoatNormalMap&&(m.clearcoatNormalMap.value=h.clearcoatNormalMap,t(h.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(h.clearcoatNormalScale),h.side===Lt&&m.clearcoatNormalScale.value.negate())),h.dispersion>0&&(m.dispersion.value=h.dispersion),h.retroreflectivity>0&&(m.retroreflectivity.value=h.retroreflectivity),h.iridescence>0&&(m.iridescence.value=h.iridescence,m.iridescenceIOR.value=h.iridescenceIOR,m.iridescenceThicknessMinimum.value=h.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=h.iridescenceThicknessRange[1],h.iridescenceMap&&(m.iridescenceMap.value=h.iridescenceMap,t(h.iridescenceMap,m.iridescenceMapTransform)),h.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=h.iridescenceThicknessMap,t(h.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),h.transmission>0&&(m.transmission.value=h.transmission,m.transmissionSamplerMap.value=A.texture,m.transmissionSamplerSize.value.set(A.width,A.height),h.transmissionMap&&(m.transmissionMap.value=h.transmissionMap,t(h.transmissionMap,m.transmissionMapTransform)),m.thickness.value=h.thickness,h.thicknessMap&&(m.thicknessMap.value=h.thicknessMap,t(h.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=h.attenuationDistance,m.attenuationColor.value.copy(h.attenuationColor)),h.anisotropy>0&&(m.anisotropyVector.value.set(h.anisotropy*Math.cos(h.anisotropyRotation),h.anisotropy*Math.sin(h.anisotropyRotation)),h.anisotropyMap&&(m.anisotropyMap.value=h.anisotropyMap,t(h.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=h.specularIntensity,m.specularColor.value.copy(h.specularColor),h.specularColorMap&&(m.specularColorMap.value=h.specularColorMap,t(h.specularColorMap,m.specularColorMapTransform)),h.specularIntensityMap&&(m.specularIntensityMap.value=h.specularIntensityMap,t(h.specularIntensityMap,m.specularIntensityMapTransform))}function x(m,h){h.matcap&&(m.matcap.value=h.matcap)}function b(m,h){const A=e.get(h).light;m.referencePosition.value.setFromMatrixPosition(A.matrixWorld),m.nearDistance.value=A.shadow.camera.near,m.farDistance.value=A.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:s}}function fm(i,e,t,n){let s={},r={},a=[];const o=i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS);function l(M,T){const E=T.program;n.uniformBlockBinding(M,E)}function c(M,T){let E=s[M.id];E===void 0&&(m(M),E=u(M),s[M.id]=E,M.addEventListener("dispose",A));const C=T.program;n.updateUBOMapping(M,C);const v=e.render.frame;r[M.id]!==v&&(d(M),r[M.id]=v)}function u(M){const T=p();M.__bindingPointIndex=T;const E=i.createBuffer(),C=M.__size,v=M.usage;return i.bindBuffer(i.UNIFORM_BUFFER,E),i.bufferData(i.UNIFORM_BUFFER,C,v),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,T,E),E}function p(){for(let M=0;M<o;M++)if(a.indexOf(M)===-1)return a.push(M),M;return qe("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function d(M){const T=s[M.id],E=M.uniforms,C=M.__cache;i.bindBuffer(i.UNIFORM_BUFFER,T);for(let v=0,w=E.length;v<w;v++){const D=E[v];if(Array.isArray(D))for(let U=0,k=D.length;U<k;U++)g(D[U],v,U,C);else g(D,v,0,C)}i.bindBuffer(i.UNIFORM_BUFFER,null)}function g(M,T,E,C){if(b(M,T,E,C)===!0){const v=M.__offset,w=M.value;if(Array.isArray(w)){let D=0;for(let U=0;U<w.length;U++){const k=w[U],W=h(k);x(k,M.__data,D),typeof k!="number"&&typeof k!="boolean"&&!k.isMatrix3&&!ArrayBuffer.isView(k)&&(D+=W.storage/Float32Array.BYTES_PER_ELEMENT)}}else x(w,M.__data,0);i.bufferSubData(i.UNIFORM_BUFFER,v,M.__data)}}function x(M,T,E){typeof M=="number"||typeof M=="boolean"?T[0]=M:M.isMatrix3?(T[0]=M.elements[0],T[1]=M.elements[1],T[2]=M.elements[2],T[3]=0,T[4]=M.elements[3],T[5]=M.elements[4],T[6]=M.elements[5],T[7]=0,T[8]=M.elements[6],T[9]=M.elements[7],T[10]=M.elements[8],T[11]=0):ArrayBuffer.isView(M)?T.set(new M.constructor(M.buffer,M.byteOffset,T.length)):M.toArray(T,E)}function b(M,T,E,C){const v=M.value,w=T+"_"+E;if(C[w]===void 0)return typeof v=="number"||typeof v=="boolean"?C[w]=v:ArrayBuffer.isView(v)?C[w]=v.slice():C[w]=v.clone(),!0;{const D=C[w];if(typeof v=="number"||typeof v=="boolean"){if(D!==v)return C[w]=v,!0}else{if(ArrayBuffer.isView(v))return!0;if(D.equals(v)===!1)return D.copy(v),!0}}return!1}function m(M){const T=M.uniforms;let E=0;const C=16;for(let w=0,D=T.length;w<D;w++){const U=Array.isArray(T[w])?T[w]:[T[w]];for(let k=0,W=U.length;k<W;k++){const I=U[k],O=Array.isArray(I.value)?I.value:[I.value];for(let j=0,X=O.length;j<X;j++){const ne=O[j],q=h(ne),Q=E%C,te=Q%q.boundary,Ae=Q+te;E+=te,Ae!==0&&C-Ae<q.storage&&(E+=C-Ae),I.__data=new Float32Array(q.storage/Float32Array.BYTES_PER_ELEMENT),I.__offset=E,E+=q.storage}}}const v=E%C;return v>0&&(E+=C-v),M.__size=E,M.__cache={},this}function h(M){const T={boundary:0,storage:0};return typeof M=="number"||typeof M=="boolean"?(T.boundary=4,T.storage=4):M.isVector2?(T.boundary=8,T.storage=8):M.isVector3||M.isColor?(T.boundary=16,T.storage=12):M.isVector4?(T.boundary=16,T.storage=16):M.isMatrix3?(T.boundary=48,T.storage=48):M.isMatrix4?(T.boundary=64,T.storage=64):M.isTexture?Re("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(M)?(T.boundary=16,T.storage=M.byteLength):Re("WebGLRenderer: Unsupported uniform value type.",M),T}function A(M){const T=M.target;T.removeEventListener("dispose",A);const E=a.indexOf(T.__bindingPointIndex);a.splice(E,1),i.deleteBuffer(s[T.id]),delete s[T.id],delete r[T.id]}function P(){for(const M in s)i.deleteBuffer(s[M]);a=[],s={},r={}}return{bind:l,update:c,dispose:P}}const pm=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]);let Qt=null;function mm(){return Qt===null&&(Qt=new ed(pm,16,16,Gn,an),Qt.name="DFG_LUT",Qt.minFilter=Tt,Qt.magFilter=Tt,Qt.wrapS=mn,Qt.wrapT=mn,Qt.generateMipmaps=!1,Qt.needsUpdate=!0),Qt}class gm{constructor(e={}){const{canvas:t=Rc(),context:n=null,depth:s=!0,stencil:r=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:u="default",failIfMajorPerformanceCaveat:p=!1,reversedDepthBuffer:d=!1,outputBufferType:g=Ot}=e;this.isWebGLRenderer=!0;let x;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");x=n.getContextAttributes().alpha}else x=a;const b=g,m=new Set([na,ta,ea]),h=new Set([Ot,rn,Ti,wi,Jr,Qr]),A=new Uint32Array(4),P=new Int32Array(4),M=new G;let T=null,E=null;const C=[],v=[];let w=null;this.domElement=t,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=sn,this.toneMappingExposure=1,this.transmissionResolutionScale=1;const D=this;let U=!1,k=null,W=null,I=null,O=null;this._outputColorSpace=kt;let j=0,X=0,ne=null,q=-1,Q=null;const te=new dt,Ae=new dt;let Te=null;const et=new Fe(0);let Ge=0,Ye=t.width,K=t.height,ee=1,_e=null,Pe=null;const ge=new dt(0,0,Ye,K),Ue=new dt(0,0,Ye,K);let mt=!1;const Oe=new aa;let Xe=!1,tt=!1;const ze=new ot,rt=new G,_t=new dt,Pt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let lt=!1;function ut(){return ne===null?ee:1}let L=n;function Mt(_,R){return t.getContext(_,R)}let Ze,y,f,F,H,Y,se,re,Z,J,ae,Ee,de,oe,ye,Ce,Le,N,le,$,ce,pe,ie;try{const _={alpha:!0,depth:s,stencil:r,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:u,failIfMajorPerformanceCaveat:p};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${Zr}`),t.addEventListener("webglcontextlost",nt,!1),t.addEventListener("webglcontextrestored",je,!1),t.addEventListener("webglcontextcreationerror",Ht,!1),L===null){const R="webgl2";if(L=Mt(R,_),L===null)throw Mt(R)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}we()}catch(_){throw t.removeEventListener("webglcontextlost",nt,!1),t.removeEventListener("webglcontextrestored",je,!1),t.removeEventListener("webglcontextcreationerror",Ht,!1),qe("WebGLRenderer: "+_.message),_}function we(){Ze=new mf(L),Ze.init(),ce=new am(L,Ze),y=new rf(L,Ze,e,ce),f=new sm(L,Ze),y.reversedDepthBuffer&&d&&f.buffers.depth.setReversed(!0),W=L.createFramebuffer(),I=L.createFramebuffer(),O=L.createFramebuffer(),F=new _f(L),H=new Wp,Y=new rm(L,Ze,f,H,y,ce,F),se=new pf(D),re=new vd(L),pe=new nf(L,re),Z=new gf(L,re,F,pe),J=new Sf(L,Z,re,pe,F),N=new vf(L,y,Y),ye=new af(H),ae=new Vp(D,se,Ze,y,pe,ye),Ee=new um(D,H),de=new qp,oe=new Jp(Ze),Le=new tf(D,se,f,J,x,l),Ce=new im(D,J,y),ie=new fm(L,F,y,f),le=new sf(L,Ze,F),$=new xf(L,Ze,F),F.programs=ae.programs,D.capabilities=y,D.extensions=Ze,D.properties=H,D.renderLists=de,D.shadowMap=Ce,D.state=f,D.info=F}b!==Ot&&(w=new bf(b,t.width,t.height,o,s,r));const Me=new dm(D,L);this.xr=Me,this.getContext=function(){return L},this.getContextAttributes=function(){return L.getContextAttributes()},this.forceContextLoss=function(){const _=Ze.get("WEBGL_lose_context");_&&_.loseContext()},this.forceContextRestore=function(){const _=Ze.get("WEBGL_lose_context");_&&_.restoreContext()},this.getPixelRatio=function(){return ee},this.setPixelRatio=function(_){_!==void 0&&(ee=_,this.setSize(Ye,K,!1))},this.getSize=function(_){return _.set(Ye,K)},this.setSize=function(_,R,V=!0){if(Me.isPresenting){Re("WebGLRenderer: Can't change size while VR device is presenting.");return}Ye=_,K=R,t.width=Math.floor(_*ee),t.height=Math.floor(R*ee),V===!0&&(t.style.width=_+"px",t.style.height=R+"px"),w!==null&&w.setSize(t.width,t.height),this.setViewport(0,0,_,R)},this.getDrawingBufferSize=function(_){return _.set(Ye*ee,K*ee).floor()},this.setDrawingBufferSize=function(_,R,V){Ye=_,K=R,ee=V,t.width=Math.floor(_*V),t.height=Math.floor(R*V),this.setViewport(0,0,_,R)},this.setEffects=function(_){if(b===Ot){qe("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(_){for(let R=0;R<_.length;R++)if(_[R].isOutputPass===!0){Re("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}w.setEffects(_||[])},this.getCurrentViewport=function(_){return _.copy(te)},this.getViewport=function(_){return _.copy(ge)},this.setViewport=function(_,R,V,B){_.isVector4?ge.set(_.x,_.y,_.z,_.w):ge.set(_,R,V,B),f.viewport(te.copy(ge).multiplyScalar(ee).round())},this.getScissor=function(_){return _.copy(Ue)},this.setScissor=function(_,R,V,B){_.isVector4?Ue.set(_.x,_.y,_.z,_.w):Ue.set(_,R,V,B),f.scissor(Ae.copy(Ue).multiplyScalar(ee).round())},this.getScissorTest=function(){return mt},this.setScissorTest=function(_){f.setScissorTest(mt=_)},this.setOpaqueSort=function(_){_e=_},this.setTransparentSort=function(_){Pe=_},this.getClearColor=function(_){return _.copy(Le.getClearColor())},this.setClearColor=function(){Le.setClearColor(...arguments)},this.getClearAlpha=function(){return Le.getClearAlpha()},this.setClearAlpha=function(){Le.setClearAlpha(...arguments)},this.clear=function(_=!0,R=!0,V=!0){let B=0;if(_){let z=!1;if(ne!==null){const fe=ne.texture.format;z=m.has(fe)}if(z){const fe=ne.texture.type,xe=h.has(fe),ue=Le.getClearColor(),ve=Le.getClearAlpha(),be=ue.r,De=ue.g,Be=ue.b;xe?(A[0]=be,A[1]=De,A[2]=Be,A[3]=ve,L.clearBufferuiv(L.COLOR,0,A)):(P[0]=be,P[1]=De,P[2]=Be,P[3]=ve,L.clearBufferiv(L.COLOR,0,P))}else B|=L.COLOR_BUFFER_BIT}R&&(B|=L.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),V&&(B|=L.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),B!==0&&L.clear(B)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(_){_.setRenderer(this),k=_},this.dispose=function(){t.removeEventListener("webglcontextlost",nt,!1),t.removeEventListener("webglcontextrestored",je,!1),t.removeEventListener("webglcontextcreationerror",Ht,!1),Le.dispose(),de.dispose(),oe.dispose(),H.dispose(),se.dispose(),J.dispose(),pe.dispose(),ie.dispose(),ae.dispose(),Me.dispose(),Me.removeEventListener("sessionstart",la),Me.removeEventListener("sessionend",ca),Ln.stop()};function nt(_){_.preventDefault(),Ta("WebGLRenderer: Context Lost."),U=!0}function je(){Ta("WebGLRenderer: Context Restored."),U=!1;const _=F.autoReset,R=Ce.enabled,V=Ce.autoUpdate,B=Ce.needsUpdate,z=Ce.type;we(),F.autoReset=_,Ce.enabled=R,Ce.autoUpdate=V,Ce.needsUpdate=B,Ce.type=z}function Ht(_){qe("WebGLRenderer: A WebGL context could not be created. Reason: ",_.statusMessage)}function Zt(_){const R=_.target;R.removeEventListener("dispose",Zt),ul(R)}function ul(_){fl(_),H.remove(_)}function fl(_){const R=H.get(_).programs;R!==void 0&&(R.forEach(function(V){ae.releaseProgram(V)}),_.isShaderMaterial&&ae.releaseShaderCache(_))}this.renderBufferDirect=function(_,R,V,B,z,fe){R===null&&(R=Pt);const xe=z.isMesh&&z.matrixWorld.determinantAffine()<0,ue=gl(_,R,V,B,z);f.setMaterial(B,xe);let ve=V.index,be=1;if(B.wireframe===!0){if(ve=Z.getWireframeAttribute(V),ve===void 0)return;be=2}const De=V.drawRange,Be=V.attributes.position;let Se=De.start*be,Ke=(De.start+De.count)*be;fe!==null&&(Se=Math.max(Se,fe.start*be),Ke=Math.min(Ke,(fe.start+fe.count)*be)),ve!==null?(Se=Math.max(Se,0),Ke=Math.min(Ke,ve.count)):Be!=null&&(Se=Math.max(Se,0),Ke=Math.min(Ke,Be.count));const ft=Ke-Se;if(ft<0||ft===1/0)return;pe.setup(z,B,ue,V,ve);let st,Qe=le;if(ve!==null&&(st=re.get(ve),Qe=$,Qe.setIndex(st)),z.isMesh)B.wireframe===!0?(f.setLineWidth(B.wireframeLinewidth*ut()),Qe.setMode(L.LINES)):Qe.setMode(L.TRIANGLES);else if(z.isLine){let bt=B.linewidth;bt===void 0&&(bt=1),f.setLineWidth(bt*ut()),z.isLineSegments?Qe.setMode(L.LINES):z.isLineLoop?Qe.setMode(L.LINE_LOOP):Qe.setMode(L.LINE_STRIP)}else z.isPoints?Qe.setMode(L.POINTS):z.isSprite&&Qe.setMode(L.TRIANGLES);if(z.isBatchedMesh)if(Ze.get("WEBGL_multi_draw"))Qe.renderMultiDraw(z._multiDrawStarts,z._multiDrawCounts,z._multiDrawCount);else{const bt=z._multiDrawStarts,me=z._multiDrawCounts,wt=z._multiDrawCount,We=ve?re.get(ve).bytesPerElement:1,Bt=H.get(B).currentProgram.getUniforms();for(let $t=0;$t<wt;$t++)Bt.setValue(L,"_gl_DrawID",$t),Qe.render(bt[$t]/We,me[$t])}else if(z.isInstancedMesh)Qe.renderInstances(Se,ft,z.count);else if(V.isInstancedBufferGeometry){const bt=V._maxInstanceCount!==void 0?V._maxInstanceCount:1/0,me=Math.min(V.instanceCount,bt);Qe.renderInstances(Se,ft,me)}else Qe.render(Se,ft)};function oa(_,R,V,B){k!==null&&_.isNodeMaterial&&k.setObject(B,_),Xe===!0&&ye.setState(_,V,!1),_.transparent===!0&&_.side===pn&&_.forceSinglePass===!1?(_.side=Lt,_.needsUpdate=!0,Ui(_,R,B),_.side=kn,_.needsUpdate=!0,Ui(_,R,B),_.side=pn):Ui(_,R,B)}this.compile=function(_,R,V=null){V===null&&(V=_),k!==null&&k.renderStart(_,R,V),E=oe.get(V),E.init(R),v.push(E),V.traverseVisible(function(z){z.isLight&&z.layers.test(R.layers)&&(E.pushLight(z),z.castShadow&&E.pushShadow(z))}),_!==V&&_.traverseVisible(function(z){z.isLight&&z.layers.test(R.layers)&&(E.pushLight(z),z.castShadow&&E.pushShadow(z))}),E.setupLights(),k!==null&&k.updateLights(E.state.lightsArray),tt=this.localClippingEnabled,Xe=ye.init(this.clippingPlanes,tt),Xe===!0&&ye.setGlobalState(this.clippingPlanes,R),k!==null&&Ce.render(E.state.shadowsArray,V,R);const B=new Set;return _.traverse(function(z){if(!(z.isMesh||z.isPoints||z.isLine||z.isSprite))return;const fe=z.material;if(fe)if(Array.isArray(fe))for(let xe=0;xe<fe.length;xe++){const ue=fe[xe];oa(ue,V,R,z),B.add(ue)}else oa(fe,V,R,z),B.add(fe)}),E=v.pop(),k!==null&&k.renderEnd(),B},this.compileAsync=function(_,R,V=null){const B=this.compile(_,R,V);return new Promise(z=>{function fe(){if(B.forEach(function(xe){const ve=H.get(xe).currentProgram;(ve===void 0||ve.isReady())&&B.delete(xe)}),B.size===0){z(_);return}setTimeout(fe,10)}Ze.get("KHR_parallel_shader_compile")!==null?fe():setTimeout(fe,10)})};let bs=null;function pl(_){bs&&bs(_)}function la(){Ln.stop()}function ca(){Ln.start()}const Ln=new sl;Ln.setAnimationLoop(pl),typeof self<"u"&&Ln.setContext(self),this.setAnimationLoop=function(_){bs=_,Me.setAnimationLoop(_),_===null?Ln.stop():Ln.start()},Me.addEventListener("sessionstart",la),Me.addEventListener("sessionend",ca),this.render=function(_,R){if(R!==void 0&&R.isCamera!==!0){qe("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(U===!0)return;k!==null&&k.renderStart(_,R);const V=Me.enabled===!0&&Me.isPresenting===!0,B=w!==null&&(ne===null||V)&&w.begin(D,ne);if(_.matrixWorldAutoUpdate===!0&&_.updateMatrixWorld(),R.parent===null&&R.matrixWorldAutoUpdate===!0&&R.updateMatrixWorld(),Me.enabled===!0&&Me.isPresenting===!0&&(w===null||w.isCompositing()===!1)&&(Me.cameraAutoUpdate===!0&&Me.updateCamera(R),R=Me.getCamera()),_.isScene===!0&&_.onBeforeRender(D,_,R,ne),E=oe.get(_,v.length),E.init(R),E.state.textureUnits=Y.getTextureUnits(),v.push(E),ze.multiplyMatrices(R.projectionMatrix,R.matrixWorldInverse),Oe.setFromProjectionMatrix(ze,nn,R.reversedDepth),tt=this.localClippingEnabled,Xe=ye.init(this.clippingPlanes,tt),T=de.get(_,C.length),T.init(),C.push(T),Me.enabled===!0&&Me.isPresenting===!0){const xe=D.xr.getDepthSensingMesh();xe!==null&&Es(xe,R,-1/0,D.sortObjects)}Es(_,R,0,D.sortObjects),T.finish(),k!==null&&k.updateLights(E.state.lightsArray),D.sortObjects===!0&&T.sort(_e,Pe),lt=Me.enabled===!1||Me.isPresenting===!1||Me.hasDepthSensing()===!1,lt&&Le.addToRenderList(T,_),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),Xe===!0&&ye.beginShadows();const z=E.state.shadowsArray;if(Ce.render(z,_,R),Xe===!0&&ye.endShadows(),(B&&w.hasRenderPass())===!1){const xe=T.opaque,ue=T.transmissive;if(E.setupLights(),R.isArrayCamera){const ve=R.cameras;if(ue.length>0)for(let be=0,De=ve.length;be<De;be++){const Be=ve[be];ha(xe,ue,_,Be)}lt&&Le.render(_);for(let be=0,De=ve.length;be<De;be++){const Be=ve[be];da(T,_,Be,Be.viewport)}}else ue.length>0&&ha(xe,ue,_,R),lt&&Le.render(_),da(T,_,R)}ne!==null&&X===0&&(Y.updateMultisampleRenderTarget(ne),Y.updateRenderTargetMipmap(ne)),B&&w.end(D),_.isScene===!0&&_.onAfterRender(D,_,R),pe.resetDefaultState(),q=-1,Q=null,v.pop(),v.length>0?(E=v[v.length-1],Y.setTextureUnits(E.state.textureUnits),Xe===!0&&ye.setGlobalState(D.clippingPlanes,E.state.camera)):E=null,C.pop(),C.length>0?T=C[C.length-1]:T=null,k!==null&&k.renderEnd()};function Es(_,R,V,B){if(_.visible===!1)return;if(_.layers.test(R.layers)){if(_.isGroup)V=_.renderOrder;else if(_.isLOD)_.autoUpdate===!0&&_.update(R);else if(_.isLightProbeGrid)E.pushLightProbeGrid(_);else if(_.isLight)E.pushLight(_),_.castShadow&&E.pushShadow(_);else if(_.isSprite){if(!_.frustumCulled||_.intersectsFrustum(Oe)){B&&_t.setFromMatrixPosition(_.matrixWorld).applyMatrix4(ze);const xe=J.update(_),ue=_.material;ue.visible&&T.push(_,xe,ue,V,_t.z,null,R)}}else if((_.isMesh||_.isLine||_.isPoints)&&(!_.frustumCulled||_.intersectsFrustum(Oe))){const xe=J.update(_),ue=_.material;if(B&&(_.boundingSphere!==void 0?(_.boundingSphere===null&&_.computeBoundingSphere(),_t.copy(_.boundingSphere.center)):(xe.boundingSphere===null&&xe.computeBoundingSphere(),_t.copy(xe.boundingSphere.center)),_t.applyMatrix4(_.matrixWorld).applyMatrix4(ze)),Array.isArray(ue)){const ve=xe.groups;for(let be=0,De=ve.length;be<De;be++){const Be=ve[be],Se=ue[Be.materialIndex];Se&&Se.visible&&T.push(_,xe,Se,V,_t.z,Be,R)}}else ue.visible&&T.push(_,xe,ue,V,_t.z,null,R)}}const fe=_.children;for(let xe=0,ue=fe.length;xe<ue;xe++)Es(fe[xe],R,V,B)}function da(_,R,V,B){const{opaque:z,transmissive:fe,transparent:xe}=_;E.setupLightsView(V),Xe===!0&&ye.setGlobalState(D.clippingPlanes,V),B&&f.viewport(te.copy(B)),z.length>0&&Ii(z,R,V),fe.length>0&&Ii(fe,R,V),xe.length>0&&Ii(xe,R,V),f.buffers.depth.setTest(!0),f.buffers.depth.setMask(!0),f.buffers.color.setMask(!0),f.setPolygonOffset(!1)}function ha(_,R,V,B){if((V.isScene===!0?V.overrideMaterial:null)!==null)return;if(E.state.transmissionRenderTarget[B.id]===void 0){const Se=Ze.has("EXT_color_buffer_half_float")||Ze.has("EXT_color_buffer_float");E.state.transmissionRenderTarget[B.id]=new Yt(1,1,{generateMipmaps:!0,type:Se?an:Ot,minFilter:Bn,samples:Math.max(4,y.samples),stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:ke.workingColorSpace})}const fe=E.state.transmissionRenderTarget[B.id],xe=B.viewport||te;fe.setSize(xe.z*D.transmissionResolutionScale,xe.w*D.transmissionResolutionScale);const ue=D.getRenderTarget(),ve=D.getActiveCubeFace(),be=D.getActiveMipmapLevel();D.setRenderTarget(fe),D.getClearColor(et),Ge=D.getClearAlpha(),Ge<1&&D.setClearColor(16777215,.5),D.clear(),lt&&Le.render(V);const De=D.toneMapping;D.toneMapping=sn;const Be=B.viewport;if(B.viewport!==void 0&&(B.viewport=void 0),E.setupLightsView(B),Xe===!0&&ye.setGlobalState(D.clippingPlanes,B),Ii(_,V,B),Y.updateMultisampleRenderTarget(fe),Y.updateRenderTargetMipmap(fe),Ze.has("WEBGL_multisampled_render_to_texture")===!1){let Se=!1;for(let Ke=0,ft=R.length;Ke<ft;Ke++){const st=R[Ke],{object:Qe,geometry:bt,material:me,group:wt}=st;if(me.side===pn&&Qe.layers.test(B.layers)){const We=me.side;me.side=Lt,me.needsUpdate=!0,ua(Qe,V,B,bt,me,wt),me.side=We,me.needsUpdate=!0,Se=!0}}Se===!0&&(Y.updateMultisampleRenderTarget(fe),Y.updateRenderTargetMipmap(fe))}D.setRenderTarget(ue,ve,be),D.setClearColor(et,Ge),Be!==void 0&&(B.viewport=Be),D.toneMapping=De}function Ii(_,R,V){const B=R.isScene===!0?R.overrideMaterial:null;for(let z=0,fe=_.length;z<fe;z++){const xe=_[z],{object:ue,geometry:ve,group:be}=xe;let De=xe.material;De.allowOverride===!0&&B!==null&&(De=B),ue.layers.test(V.layers)&&ua(ue,R,V,ve,De,be)}}function ua(_,R,V,B,z,fe){k!==null&&z.isNodeMaterial&&k.setObject(_,z),_.onBeforeRender(D,R,V,B,z,fe),_.modelViewMatrix.multiplyMatrices(V.matrixWorldInverse,_.matrixWorld),_.normalMatrix.getNormalMatrix(_.modelViewMatrix),z.onBeforeRender(D,R,V,B,_,fe),z.transparent===!0&&z.side===pn&&z.forceSinglePass===!1?(z.side=Lt,z.needsUpdate=!0,D.renderBufferDirect(V,R,B,z,_,fe),z.side=kn,z.needsUpdate=!0,D.renderBufferDirect(V,R,B,z,_,fe),z.side=pn):D.renderBufferDirect(V,R,B,z,_,fe),_.onAfterRender(D,R,V,B,z,fe)}function Ui(_,R,V){R.isScene!==!0&&(R=Pt);const B=H.get(_),z=E.state.lights,fe=E.state.shadowsArray,xe=z.state.version,ue=ae.getParameters(_,z.state,fe,R,V,E.state.lightProbeGridArray),ve=ae.getProgramCacheKey(ue);let be=B.programs;B.environment=_.isMeshStandardMaterial||_.isMeshLambertMaterial||_.isMeshPhongMaterial?R.environment:null,B.fog=R.fog;const De=_.isMeshStandardMaterial||_.isMeshLambertMaterial&&!_.envMap||_.isMeshPhongMaterial&&!_.envMap;B.envMap=se.get(_.envMap||B.environment,De),B.envMapRotation=B.environment!==null&&_.envMap===null?R.environmentRotation:_.envMapRotation,be===void 0&&(_.addEventListener("dispose",Zt),be=new Map,B.programs=be);let Be=be.get(ve);if(Be!==void 0){if(B.currentProgram===Be&&B.lightsStateVersion===xe)return pa(_,ue),Be}else ue.uniforms=ae.getUniforms(_),k!==null&&_.isNodeMaterial&&k.build(_,V,ue),_.onBeforeCompile(ue,D),Be=ae.acquireProgram(ue,ve),be.set(ve,Be),B.uniforms=ue.uniforms;const Se=B.uniforms;return(!_.isShaderMaterial&&!_.isRawShaderMaterial||_.clipping===!0)&&(Se.clippingPlanes=ye.uniform),pa(_,ue),B.needsLights=_l(_),B.lightsStateVersion=xe,B.needsLights&&(Se.ambientLightColor.value=z.state.ambient,Se.lightProbe.value=z.state.probe,Se.sunLights.value=z.state.sun,Se.sunLightShadows.value=z.state.sunShadow,Se.directionalLights.value=z.state.directional,Se.directionalLightShadows.value=z.state.directionalShadow,Se.spotLights.value=z.state.spot,Se.spotLightShadows.value=z.state.spotShadow,Se.rectAreaLights.value=z.state.rectArea,Se.ltc_1.value=z.state.rectAreaLTC1,Se.ltc_2.value=z.state.rectAreaLTC2,Se.pointLights.value=z.state.point,Se.pointLightShadows.value=z.state.pointShadow,Se.hemisphereLights.value=z.state.hemi,Se.sunShadowMatrix.value=z.state.sunShadowMatrix,Se.sunShadowCascade.value=z.state.sunShadowCascade,Se.directionalShadowMatrix.value=z.state.directionalShadowMatrix,Se.spotLightMatrix.value=z.state.spotLightMatrix,Se.spotLightMap.value=z.state.spotLightMap,Se.pointShadowMatrix.value=z.state.pointShadowMatrix),B.lightProbeGrid=E.state.lightProbeGridArray.length>0,B.currentProgram=Be,B.uniformsList=null,Be}function fa(_){if(_.uniformsList===null){const R=_.currentProgram.getUniforms();_.uniformsList=us.seqWithValue(R.seq,_.uniforms)}return _.uniformsList}function pa(_,R){const V=H.get(_);V.outputColorSpace=R.outputColorSpace,V.batching=R.batching,V.batchingColor=R.batchingColor,V.instancing=R.instancing,V.instancingColor=R.instancingColor,V.instancingMorph=R.instancingMorph,V.skinning=R.skinning,V.morphTargets=R.morphTargets,V.morphNormals=R.morphNormals,V.morphColors=R.morphColors,V.morphTargetsCount=R.morphTargetsCount,V.numClippingPlanes=R.numClippingPlanes,V.numIntersection=R.numClipIntersection,V.vertexAlphas=R.vertexAlphas,V.vertexTangents=R.vertexTangents,V.toneMapping=R.toneMapping}function ml(_,R){if(_.length===0)return null;if(_.length===1)return _[0].texture!==null?_[0]:null;M.setFromMatrixPosition(R.matrixWorld);for(let V=0,B=_.length;V<B;V++){const z=_[V];if(z.texture!==null&&z.boundingBox.containsPoint(M))return z}return null}function gl(_,R,V,B,z){R.isScene!==!0&&(R=Pt),Y.resetTextureUnits();const fe=R.fog,xe=B.isMeshStandardMaterial||B.isMeshLambertMaterial||B.isMeshPhongMaterial?R.environment:null,ue=ne===null?D.outputColorSpace:ne.isXRRenderTarget===!0?ne.texture.colorSpace:ke.workingColorSpace,ve=B.isMeshStandardMaterial||B.isMeshLambertMaterial&&!B.envMap||B.isMeshPhongMaterial&&!B.envMap,be=se.get(B.envMap||xe,ve),De=B.vertexColors===!0&&!!V.attributes.color&&V.attributes.color.itemSize===4,Be=!!V.attributes.tangent&&(!!B.normalMap||B.anisotropy>0),Se=!!V.morphAttributes.position,Ke=!!V.morphAttributes.normal,ft=!!V.morphAttributes.color;let st=sn;B.toneMapped&&(ne===null||ne.isXRRenderTarget===!0)&&(st=D.toneMapping);const Qe=V.morphAttributes.position||V.morphAttributes.normal||V.morphAttributes.color,bt=Qe!==void 0?Qe.length:0,me=H.get(B),wt=E.state.lights;if(Xe===!0&&(tt===!0||_!==Q)){const it=_===Q&&B.id===q;ye.setState(B,_,it)}let We=!1;B.version===me.__version?(me.needsLights&&me.lightsStateVersion!==wt.state.version||me.outputColorSpace!==ue||z.isBatchedMesh&&me.batching===!1||!z.isBatchedMesh&&me.batching===!0||z.isBatchedMesh&&me.batchingColor===!0&&z._colorsTexture===null||z.isBatchedMesh&&me.batchingColor===!1&&z._colorsTexture!==null||z.isInstancedMesh&&me.instancing===!1||!z.isInstancedMesh&&me.instancing===!0||z.isSkinnedMesh&&me.skinning===!1||!z.isSkinnedMesh&&me.skinning===!0||z.isInstancedMesh&&me.instancingColor===!0&&z.instanceColor===null||z.isInstancedMesh&&me.instancingColor===!1&&z.instanceColor!==null||z.isInstancedMesh&&me.instancingMorph===!0&&z.morphTexture===null||z.isInstancedMesh&&me.instancingMorph===!1&&z.morphTexture!==null||me.envMap!==be||B.fog===!0&&me.fog!==fe||me.numClippingPlanes!==void 0&&(me.numClippingPlanes!==ye.numPlanes||me.numIntersection!==ye.numIntersection)||me.vertexAlphas!==De||me.vertexTangents!==Be||me.morphTargets!==Se||me.morphNormals!==Ke||me.morphColors!==ft||me.toneMapping!==st||me.morphTargetsCount!==bt||!!me.lightProbeGrid!=E.state.lightProbeGridArray.length>0)&&(We=!0):(We=!0,me.__version=B.version);let Bt=me.currentProgram;We===!0&&(Bt=Ui(B,R,z),k&&B.isNodeMaterial&&k.onUpdateProgram(B,Bt,me));let $t=!1,Sn=!1,Wn=!1;const Je=Bt.getUniforms(),ht=me.uniforms;if(f.useProgram(Bt.program)&&($t=!0,Sn=!0,Wn=!0),B.id!==q&&(q=B.id,Sn=!0),me.needsLights){const it=ml(E.state.lightProbeGridArray,z);me.lightProbeGrid!==it&&(me.lightProbeGrid=it,Sn=!0)}if($t||Q!==_){f.buffers.depth.getReversed()&&_.reversedDepth!==!0&&(_._reversedDepth=!0,_.updateProjectionMatrix()),Je.setValue(L,"projectionMatrix",_.projectionMatrix),Je.setValue(L,"viewMatrix",_.matrixWorldInverse);const bn=Je.map.cameraPosition;bn!==void 0&&bn.setValue(L,rt.setFromMatrixPosition(_.matrixWorld)),y.logarithmicDepthBuffer&&Je.setValue(L,"logDepthBufFC",2/(Math.log(_.far+1)/Math.LN2)),(B.isMeshPhongMaterial||B.isMeshToonMaterial||B.isMeshLambertMaterial||B.isMeshBasicMaterial||B.isMeshStandardMaterial||B.isShaderMaterial)&&Je.setValue(L,"isOrthographic",_.isOrthographicCamera===!0),Q!==_&&(Q=_,Sn=!0,Wn=!0)}if(me.needsLights&&(wt.state.sunShadowMap.length>0&&Je.setValue(L,"sunShadowMap",wt.state.sunShadowMap,Y),wt.state.directionalShadowMap.length>0&&Je.setValue(L,"directionalShadowMap",wt.state.directionalShadowMap,Y),wt.state.spotShadowMap.length>0&&Je.setValue(L,"spotShadowMap",wt.state.spotShadowMap,Y),wt.state.pointShadowMap.length>0&&Je.setValue(L,"pointShadowMap",wt.state.pointShadowMap,Y)),z.isSkinnedMesh){Je.setOptional(L,z,"bindMatrix"),Je.setOptional(L,z,"bindMatrixInverse");const it=z.skeleton;it&&(it.boneTexture===null&&it.computeBoneTexture(),Je.setValue(L,"boneTexture",it.boneTexture,Y))}z.isBatchedMesh&&(Je.setOptional(L,z,"batchingTexture"),Je.setValue(L,"batchingTexture",z._matricesTexture,Y),Je.setOptional(L,z,"batchingIdTexture"),Je.setValue(L,"batchingIdTexture",z._indirectTexture,Y),Je.setOptional(L,z,"batchingColorTexture"),z._colorsTexture!==null&&Je.setValue(L,"batchingColorTexture",z._colorsTexture,Y));const Mn=V.morphAttributes;if((Mn.position!==void 0||Mn.normal!==void 0||Mn.color!==void 0)&&N.update(z,V,Bt),(Sn||me.receiveShadow!==z.receiveShadow)&&(me.receiveShadow=z.receiveShadow,Je.setValue(L,"receiveShadow",z.receiveShadow)),(B.isMeshStandardMaterial||B.isMeshLambertMaterial||B.isMeshPhongMaterial)&&B.envMap===null&&R.environment!==null&&(ht.envMapIntensity.value=R.environmentIntensity),ht.dfgLUT!==void 0&&(ht.dfgLUT.value=mm()),Sn){if(Je.setValue(L,"toneMappingExposure",D.toneMappingExposure),me.needsLights&&xl(ht,Wn),fe&&B.fog===!0&&Ee.refreshFogUniforms(ht,fe),Ee.refreshMaterialUniforms(ht,B,ee,K,E.state.transmissionRenderTarget[_.id]),me.needsLights&&me.lightProbeGrid){const it=me.lightProbeGrid;ht.probesSH.value=it.texture,ht.probesMin.value.copy(it.boundingBox.min),ht.probesMax.value.copy(it.boundingBox.max),ht.probesResolution.value.copy(it.resolution)}us.upload(L,fa(me),ht,Y)}if(B.isShaderMaterial&&B.uniformsNeedUpdate===!0&&(us.upload(L,fa(me),ht,Y),B.uniformsNeedUpdate=!1),B.isSpriteMaterial&&Je.setValue(L,"center",z.center),Je.setValue(L,"modelViewMatrix",z.modelViewMatrix),Je.setValue(L,"normalMatrix",z.normalMatrix),Je.setValue(L,"modelMatrix",z.matrixWorld),B.uniformsGroups!==void 0){const it=B.uniformsGroups;for(let bn=0,Xn=it.length;bn<Xn;bn++){const ga=it[bn];ie.update(ga,Bt),ie.bind(ga,Bt)}}return Bt}function xl(_,R){_.ambientLightColor.needsUpdate=R,_.lightProbe.needsUpdate=R,_.sunLights.needsUpdate=R,_.sunLightShadows.needsUpdate=R,_.directionalLights.needsUpdate=R,_.directionalLightShadows.needsUpdate=R,_.pointLights.needsUpdate=R,_.pointLightShadows.needsUpdate=R,_.spotLights.needsUpdate=R,_.spotLightShadows.needsUpdate=R,_.rectAreaLights.needsUpdate=R,_.hemisphereLights.needsUpdate=R}function _l(_){return _.isMeshLambertMaterial||_.isMeshToonMaterial||_.isMeshPhongMaterial||_.isMeshStandardMaterial||_.isShadowMaterial||_.isShaderMaterial&&_.lights===!0}this.getActiveCubeFace=function(){return j},this.getActiveMipmapLevel=function(){return X},this.getRenderTarget=function(){return ne},this.setRenderTargetTextures=function(_,R,V){const B=H.get(_);B.__autoAllocateDepthBuffer=_.resolveDepthBuffer===!1,B.__autoAllocateDepthBuffer===!1&&(B.__useRenderToTexture=!1),H.get(_.texture).__webglTexture=R,H.get(_.depthTexture).__webglTexture=B.__autoAllocateDepthBuffer?void 0:V,B.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(_,R){const V=H.get(_);V.__webglFramebuffer=R,V.__useDefaultFramebuffer=R===void 0},this.setRenderTarget=function(_,R=0,V=0){ne=_,j=R,X=V;let B=null,z=!1,fe=!1;if(_){const ue=H.get(_);if(ue.__useDefaultFramebuffer!==void 0){f.bindFramebuffer(L.FRAMEBUFFER,ue.__webglFramebuffer),te.copy(_.viewport),Ae.copy(_.scissor),Te=_.scissorTest,f.viewport(te),f.scissor(Ae),f.setScissorTest(Te),q=-1;return}else if(ue.__webglFramebuffer===void 0)Y.setupRenderTarget(_);else if(ue.__hasExternalTextures)Y.rebindTextures(_,H.get(_.texture).__webglTexture,H.get(_.depthTexture).__webglTexture);else if(_.depthBuffer){const De=_.depthTexture;if(ue.__boundDepthTexture!==De){if(De!==null&&H.has(De)&&(_.width!==De.image.width||_.height!==De.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");Y.setupDepthRenderbuffer(_)}}const ve=_.texture;(ve.isData3DTexture||ve.isDataArrayTexture||ve.isCompressedArrayTexture)&&(fe=!0);const be=H.get(_).__webglFramebuffer;_.isWebGLCubeRenderTarget?(Array.isArray(be[R])?B=be[R][V]:B=be[R],z=!0):_.samples>0&&Y.useMultisampledRTT(_)===!1?B=H.get(_).__webglMultisampledFramebuffer:Array.isArray(be)?B=be[V]:B=be,te.copy(_.viewport),Ae.copy(_.scissor),Te=_.scissorTest}else te.copy(ge).multiplyScalar(ee).floor(),Ae.copy(Ue).multiplyScalar(ee).floor(),Te=mt;if(V!==0&&(B=W),f.bindFramebuffer(L.FRAMEBUFFER,B)&&f.drawBuffers(_,B),f.viewport(te),f.scissor(Ae),f.setScissorTest(Te),z){const ue=H.get(_.texture);L.framebufferTexture2D(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_CUBE_MAP_POSITIVE_X+R,ue.__webglTexture,V)}else if(fe){const ue=R;for(let ve=0;ve<_.textures.length;ve++){const be=H.get(_.textures[ve]);L.framebufferTextureLayer(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0+ve,be.__webglTexture,V,ue)}}else if(_!==null&&V!==0){const ue=H.get(_.texture);L.framebufferTexture2D(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,ue.__webglTexture,V)}q=-1};function ma(_){const R=H.get(_);return(R.__readFormat!==_.format||R.__readType!==_.type)&&(R.__readFormat=_.format,R.__readType=_.type,R.__formatReadable=y.textureFormatReadable(_.format),R.__typeReadable=y.textureTypeReadable(_.type)),R}this.readRenderTargetPixels=function(_,R,V,B,z,fe,xe,ue=0){if(!(_&&_.isWebGLRenderTarget)){qe("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let ve=H.get(_).__webglFramebuffer;if(_.isWebGLCubeRenderTarget&&xe!==void 0&&(ve=ve[xe]),ve){f.bindFramebuffer(L.FRAMEBUFFER,ve);try{const be=_.textures[ue],De=be.format,Be=be.type;_.textures.length>1&&L.readBuffer(L.COLOR_ATTACHMENT0+ue);const Se=ma(be);if(Se.__formatReadable===!1){qe("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(Se.__typeReadable===!1){qe("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}R>=0&&R<=_.width-B&&V>=0&&V<=_.height-z&&L.readPixels(R,V,B,z,ce.convert(De),ce.convert(Be),fe)}finally{const be=ne!==null?H.get(ne).__webglFramebuffer:null;f.bindFramebuffer(L.FRAMEBUFFER,be)}}},this.readRenderTargetPixelsAsync=async function(_,R,V,B,z,fe,xe,ue=0){if(!(_&&_.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let ve=H.get(_).__webglFramebuffer;if(_.isWebGLCubeRenderTarget&&xe!==void 0&&(ve=ve[xe]),ve)if(R>=0&&R<=_.width-B&&V>=0&&V<=_.height-z){f.bindFramebuffer(L.FRAMEBUFFER,ve);const be=_.textures[ue],De=be.format,Be=be.type;_.textures.length>1&&L.readBuffer(L.COLOR_ATTACHMENT0+ue);const Se=ma(be);if(Se.__formatReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(Se.__typeReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");const Ke=L.createBuffer();L.bindBuffer(L.PIXEL_PACK_BUFFER,Ke),L.bufferData(L.PIXEL_PACK_BUFFER,fe.byteLength,L.STREAM_READ),L.readPixels(R,V,B,z,ce.convert(De),ce.convert(Be),0),L.bindBuffer(L.PIXEL_PACK_BUFFER,null);const ft=ne!==null?H.get(ne).__webglFramebuffer:null;f.bindFramebuffer(L.FRAMEBUFFER,ft);const st=L.fenceSync(L.SYNC_GPU_COMMANDS_COMPLETE,0);return L.flush(),await Pc(L,st,4),L.bindBuffer(L.PIXEL_PACK_BUFFER,Ke),L.getBufferSubData(L.PIXEL_PACK_BUFFER,0,fe),L.bindBuffer(L.PIXEL_PACK_BUFFER,null),L.deleteBuffer(Ke),L.deleteSync(st),fe}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(_,R=null,V=0){const B=Math.pow(2,-V),z=Math.floor(_.image.width*B),fe=Math.floor(_.image.height*B),xe=R!==null?R.x:0,ue=R!==null?R.y:0;Y.setTexture2D(_,0),L.copyTexSubImage2D(L.TEXTURE_2D,V,0,0,xe,ue,z,fe),f.unbindTexture()},this.copyTextureToTexture=function(_,R,V=null,B=null,z=0,fe=0){let xe,ue,ve,be,De,Be,Se,Ke,ft;const st=_.isCompressedTexture?_.mipmaps[fe]:_.image;if(V!==null)xe=V.max.x-V.min.x,ue=V.max.y-V.min.y,ve=V.isBox3?V.max.z-V.min.z:1,be=V.min.x,De=V.min.y,Be=V.isBox3?V.min.z:0;else{const ht=Math.pow(2,-z);xe=Math.floor(st.width*ht),ue=Math.floor(st.height*ht),_.isDataArrayTexture?ve=st.depth:_.isData3DTexture?ve=Math.floor(st.depth*ht):ve=1,be=0,De=0,Be=0}B!==null?(Se=B.x,Ke=B.y,ft=B.z):(Se=0,Ke=0,ft=0);const Qe=ce.convert(R.format),bt=ce.convert(R.type);let me;R.isData3DTexture?(Y.setTexture3D(R,0),me=L.TEXTURE_3D):R.isDataArrayTexture||R.isCompressedArrayTexture?(Y.setTexture2DArray(R,0),me=L.TEXTURE_2D_ARRAY):(Y.setTexture2D(R,0),me=L.TEXTURE_2D),f.activeTexture(L.TEXTURE0),f.pixelStorei(L.UNPACK_FLIP_Y_WEBGL,R.flipY),f.pixelStorei(L.UNPACK_PREMULTIPLY_ALPHA_WEBGL,R.premultiplyAlpha),f.pixelStorei(L.UNPACK_ALIGNMENT,R.unpackAlignment);const wt=f.getParameter(L.UNPACK_ROW_LENGTH),We=f.getParameter(L.UNPACK_IMAGE_HEIGHT),Bt=f.getParameter(L.UNPACK_SKIP_PIXELS),$t=f.getParameter(L.UNPACK_SKIP_ROWS),Sn=f.getParameter(L.UNPACK_SKIP_IMAGES);f.pixelStorei(L.UNPACK_ROW_LENGTH,st.width),f.pixelStorei(L.UNPACK_IMAGE_HEIGHT,st.height),f.pixelStorei(L.UNPACK_SKIP_PIXELS,be),f.pixelStorei(L.UNPACK_SKIP_ROWS,De),f.pixelStorei(L.UNPACK_SKIP_IMAGES,Be);const Wn=_.isDataArrayTexture||_.isData3DTexture,Je=R.isDataArrayTexture||R.isData3DTexture;if(_.isDepthTexture){const ht=H.get(_),Mn=H.get(R),it=H.get(ht.__renderTarget),bn=H.get(Mn.__renderTarget);f.bindFramebuffer(L.READ_FRAMEBUFFER,it.__webglFramebuffer),f.bindFramebuffer(L.DRAW_FRAMEBUFFER,bn.__webglFramebuffer);for(let Xn=0;Xn<ve;Xn++)Wn&&(L.framebufferTextureLayer(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,H.get(_).__webglTexture,z,Be+Xn),L.framebufferTextureLayer(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,H.get(R).__webglTexture,fe,ft+Xn)),L.blitFramebuffer(be,De,xe,ue,Se,Ke,xe,ue,L.DEPTH_BUFFER_BIT,L.NEAREST);f.bindFramebuffer(L.READ_FRAMEBUFFER,null),f.bindFramebuffer(L.DRAW_FRAMEBUFFER,null)}else if(z!==0||_.isRenderTargetTexture||H.has(_)){const ht=H.get(_),Mn=H.get(R);f.bindFramebuffer(L.READ_FRAMEBUFFER,I),f.bindFramebuffer(L.DRAW_FRAMEBUFFER,O);for(let it=0;it<ve;it++)Wn?L.framebufferTextureLayer(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,ht.__webglTexture,z,Be+it):L.framebufferTexture2D(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,ht.__webglTexture,z),Je?L.framebufferTextureLayer(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,Mn.__webglTexture,fe,ft+it):L.framebufferTexture2D(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,Mn.__webglTexture,fe),z!==0?L.blitFramebuffer(be,De,xe,ue,Se,Ke,xe,ue,L.COLOR_BUFFER_BIT,L.NEAREST):Je?L.copyTexSubImage3D(me,fe,Se,Ke,ft+it,be,De,xe,ue):L.copyTexSubImage2D(me,fe,Se,Ke,be,De,xe,ue);f.bindFramebuffer(L.READ_FRAMEBUFFER,null),f.bindFramebuffer(L.DRAW_FRAMEBUFFER,null)}else Je?_.isDataTexture||_.isData3DTexture?L.texSubImage3D(me,fe,Se,Ke,ft,xe,ue,ve,Qe,bt,st.data):R.isCompressedArrayTexture?L.compressedTexSubImage3D(me,fe,Se,Ke,ft,xe,ue,ve,Qe,st.data):L.texSubImage3D(me,fe,Se,Ke,ft,xe,ue,ve,Qe,bt,st):_.isDataTexture?L.texSubImage2D(L.TEXTURE_2D,fe,Se,Ke,xe,ue,Qe,bt,st.data):_.isCompressedTexture?L.compressedTexSubImage2D(L.TEXTURE_2D,fe,Se,Ke,st.width,st.height,Qe,st.data):L.texSubImage2D(L.TEXTURE_2D,fe,Se,Ke,xe,ue,Qe,bt,st);f.pixelStorei(L.UNPACK_ROW_LENGTH,wt),f.pixelStorei(L.UNPACK_IMAGE_HEIGHT,We),f.pixelStorei(L.UNPACK_SKIP_PIXELS,Bt),f.pixelStorei(L.UNPACK_SKIP_ROWS,$t),f.pixelStorei(L.UNPACK_SKIP_IMAGES,Sn),fe===0&&R.generateMipmaps&&L.generateMipmap(me),f.unbindTexture()},this.initRenderTarget=function(_){H.get(_).__webglFramebuffer===void 0&&Y.setupRenderTarget(_)},this.initTexture=function(_){_.isCubeTexture?Y.setTextureCube(_,0):_.isData3DTexture?Y.setTexture3D(_,0):_.isDataArrayTexture||_.isCompressedArrayTexture?Y.setTexture2DArray(_,0):Y.setTexture2D(_,0),f.unbindTexture()},this.resetState=function(){j=0,X=0,ne=null,f.reset(),pe.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return nn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;const t=this.getContext();t.drawingBufferColorSpace=ke._getDrawingBufferColorSpace(e),t.unpackColorSpace=ke._getUnpackColorSpace()}}function xm({scrollY:i=0}){const e=at.useRef(null),t=at.useRef(i);return t.current=i,at.useEffect(()=>{const n=e.current;if(!n)return;const s=window.innerWidth<768,r=window.matchMedia("(prefers-reduced-motion: reduce)").matches,a=new qc,o=new Ut(45,window.innerWidth/window.innerHeight,.1,1e3);o.position.z=24;const l=new gm({alpha:!0,antialias:!s});l.setSize(window.innerWidth,window.innerHeight),l.setPixelRatio(Math.min(window.devicePixelRatio,s?1.5:2)),n.appendChild(l.domElement);const c=new pd(16774634,.8);a.add(c);const u=new Ya(15255464,2.5,50);u.position.set(10,10,15),a.add(u);const p=new Ya(12021369,1.8,40);p.position.set(-10,-10,10),a.add(p);const d=s?120:360,g=new Kt,x=new Float32Array(d*3),b=new Float32Array(d*3),m=[new Fe(12094786),new Fe(15255464),new Fe(12021369),new Fe(16249577)];for(let O=0;O<d;O++){x[O*3]=(Math.random()-.5)*50,x[O*3+1]=(Math.random()-.5)*60,x[O*3+2]=(Math.random()-.5)*40;const j=m[Math.floor(Math.random()*m.length)];b[O*3]=j.r,b[O*3+1]=j.g,b[O*3+2]=j.b}g.setAttribute("position",new jt(x,3)),g.setAttribute("color",new jt(b,3));const h=new Zo({size:s?.35:.45,vertexColors:!0,transparent:!0,opacity:.75,blending:ir}),A=new nd(g,h);a.add(A);const P=new Di(36,26,s?16:32,s?16:32),M=new cd({color:2364445,roughness:.6,metalness:.4,wireframe:!0,transparent:!0,opacity:.12}),T=new on(P,M);T.rotation.x=-Math.PI/4,T.position.z=-5,a.add(T);let E=0,C=0,v=0,w=0;const D=O=>{E=(O.clientX/window.innerWidth-.5)*2,C=(O.clientY/window.innerHeight-.5)*2};window.addEventListener("mousemove",D,{passive:!0});const U=()=>{o.aspect=window.innerWidth/window.innerHeight,o.updateProjectionMatrix(),l.setSize(window.innerWidth,window.innerHeight)};window.addEventListener("resize",U);let k,W=new xd;const I=()=>{if(k=requestAnimationFrame(I),r){l.render(a,o);return}const O=W.getElapsedTime();v+=(E-v)*.05,w+=(C-w)*.05;const j=(t.current||0)*.008;o.position.z=24-j*.2,o.position.x=v*1.5,o.position.y=-w*1.5-j*.4,o.lookAt(0,-j*.4,0),A.rotation.y=O*.03,A.rotation.x=O*.015;const X=P.attributes.position;for(let ne=0;ne<X.count;ne++){const q=X.getX(ne),Q=X.getY(ne),te=Math.sin(q*.3+O*1.2)*.8+Math.cos(Q*.3+O*.9)*.6;X.setZ(ne,te)}X.needsUpdate=!0,l.render(a,o)};return I(),()=>{cancelAnimationFrame(k),window.removeEventListener("mousemove",D),window.removeEventListener("resize",U),n&&l.domElement&&n.removeChild(l.domElement),g.dispose(),h.dispose(),P.dispose(),M.dispose(),l.dispose()}},[]),S.jsx("div",{ref:e,className:"fixed inset-0 pointer-events-none z-[1] overflow-hidden","aria-hidden":"true"})}function _m({onComplete:i}){const[e,t]=at.useState("logo");return at.useEffect(()=>{if(typeof document<"u"&&document.hidden){i();return}const n=setTimeout(()=>t("brand"),450),s=setTimeout(()=>t("fadeout"),1250),r=setTimeout(()=>{t("done"),i()},1750);return()=>{clearTimeout(n),clearTimeout(s),clearTimeout(r)}},[i]),e==="done"?null:S.jsx("div",{className:`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#140D08] text-[#FAF7F2] transition-opacity duration-600 select-none ${e==="fadeout"?"opacity-0 pointer-events-none":"opacity-100"}`,children:S.jsxs("div",{className:"flex flex-col items-center gap-5 text-center px-6",children:[S.jsxs("div",{className:"relative",children:[S.jsx("div",{className:"w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white/5 border border-white/10 p-2 shadow-2xl flex items-center justify-center backdrop-blur-md animate-pulse",children:S.jsx("img",{src:"/Main_logo.png",alt:"BSC Textiles",className:"w-full h-full object-contain"})}),S.jsx("div",{className:"absolute -inset-3 rounded-full bg-[#E8C7A8]/10 blur-xl pointer-events-none"})]}),S.jsxs("div",{className:`space-y-1.5 transition-all duration-700 transform ${e==="brand"||e==="fadeout"?"opacity-100 translate-y-0":"opacity-0 translate-y-2"}`,children:[S.jsx("h1",{className:"font-serif tracking-[0.2em] text-lg sm:text-xl font-bold text-[#E8C7A8] uppercase",children:"BSC Textiles"}),S.jsx("p",{className:"text-[10px] sm:text-xs font-medium tracking-[0.16em] uppercase text-[#A69385]",children:"Established 1938 · Five Generations"})]}),S.jsx("div",{className:"w-28 h-[2px] bg-white/10 rounded-full overflow-hidden mt-2",children:S.jsx("div",{className:"w-full h-full bg-gradient-to-r from-[#B76E79] via-[#E8C7A8] to-[#B76E79] animate-[shimmer_1.5s_infinite]"})})]})})}function vm({onScrollTo:i,scrollY:e=0}){const t=ct.floatingCards,[n,s]=at.useState(0),[r,a]=at.useState(!1),[o,l]=at.useState(!1),c=at.useRef(null),[u,p]=at.useState({x:0,y:0});at.useEffect(()=>{const E=C=>{if(window.innerWidth<768)return;const v=(C.clientX/window.innerWidth-.5)*8,w=(C.clientY/window.innerHeight-.5)*-8;p({x:v,y:w})};return window.addEventListener("mousemove",E,{passive:!0}),()=>window.removeEventListener("mousemove",E)},[]),at.useEffect(()=>{if(!o)return c.current=window.setInterval(()=>{d()},5200),()=>{c.current&&clearInterval(c.current)}},[n,o]);const d=()=>{a(!0),setTimeout(()=>{s(E=>(E+1)%t.length),a(!1)},280)},g=()=>{a(!0),setTimeout(()=>{s(E=>(E-1+t.length)%t.length),a(!1)},280)},x=E=>{E!==n&&(a(!0),setTimeout(()=>{s(E),a(!1)},280))},b=t[n],h=Math.min(Math.max(e,0),600)/600,A=1-h*.28,P=-h*70,M=1-h*.45,T=1+h*.12;return S.jsxs("section",{id:"hero",className:"relative min-h-[94vh] flex flex-col items-center justify-between text-center px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-12 overflow-hidden select-none [perspective:1200px]",children:[S.jsx("div",{className:"absolute inset-0 pointer-events-none opacity-20 mix-blend-multiply bg-cover bg-center transition-transform duration-300 ease-out",style:{backgroundImage:"url('/images/hero-bg.webp')",transform:`scale(${T}) translate3d(${u.x*-1.5}px, ${u.y*-1.5}px, 0)`},"aria-hidden":"true"}),S.jsx("div",{className:"absolute inset-0 pointer-events-none bg-gradient-to-b from-[#FAF7F2]/40 via-transparent to-[#FAF7F2]/90","aria-hidden":"true"}),S.jsx("div",{className:"hidden lg:block absolute left-8 top-1/4 w-32 h-44 rounded-2xl overflow-hidden border border-white/40 shadow-xl opacity-40 pointer-events-none transition-transform duration-500 ease-out",style:{transform:`translate3d(${u.x*2.5}px, ${u.y*2.5-e*.15}px, 0) rotateZ(-4deg)`},"aria-hidden":"true",children:S.jsx("img",{src:"/images/women-real.webp",alt:"",className:"w-full h-full object-cover"})}),S.jsx("div",{className:"hidden lg:block absolute right-8 top-1/3 w-36 h-48 rounded-2xl overflow-hidden border border-white/40 shadow-xl opacity-40 pointer-events-none transition-transform duration-500 ease-out",style:{transform:`translate3d(${u.x*-2.5}px, ${u.y*-2.5-e*.12}px, 0) rotateZ(4deg)`},"aria-hidden":"true",children:S.jsx("img",{src:"/images/suit.webp",alt:"",className:"w-full h-full object-cover"})}),S.jsxs("div",{className:"relative z-10 max-w-4xl mx-auto flex flex-col items-center mt-2 sm:mt-4 transition-transform duration-300 ease-out",style:{transform:`translate3d(${u.x}px, ${P+u.y}px, 0) rotateX(${u.y*.5}deg) rotateY(${u.x*.5}deg)`,opacity:M},children:[S.jsx("div",{className:"mb-4 sm:mb-6 transition-transform duration-300 ease-out",style:{transform:`scale(${A})`},children:S.jsxs("div",{className:"relative group",children:[S.jsx("div",{className:"w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-white/70 backdrop-blur-md border border-[#E4D8C4] p-2.5 shadow-lg flex items-center justify-center transition-transform duration-500 group-hover:scale-105",children:S.jsx("img",{src:"/Main_logo.png",alt:"BSC Textiles",className:"w-full h-full object-contain"})}),S.jsx("div",{className:"absolute -inset-2 rounded-full bg-[#E8C7A8]/20 blur-md pointer-events-none -z-10"})]})}),S.jsxs("div",{className:"inline-flex items-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-full bg-white/70 backdrop-blur-md border border-[#E4D8C4] shadow-sm mb-5 transition-transform duration-300 hover:scale-105",children:[S.jsx("span",{className:"w-1.5 h-1.5 rounded-full bg-[#B76E79] animate-pulse"}),S.jsx("span",{className:"text-[10px] sm:text-xs font-bold tracking-[0.18em] uppercase text-[#4A173A]",children:ct.hero.badge})]}),S.jsx("h1",{className:"font-serif text-4xl sm:text-6xl md:text-7xl lg:text-[88px] leading-[1.04] tracking-[-0.02em] font-medium text-[#1A120C]",children:S.jsx("span",{children:ct.hero.title})}),S.jsx("p",{className:"font-serif italic text-lg sm:text-2xl md:text-3xl text-[#B76E79] mt-2 font-normal tracking-wide",children:ct.hero.subtitle}),S.jsx("p",{className:"mt-4 sm:mt-5 max-w-xl mx-auto text-xs sm:text-sm md:text-base leading-relaxed text-[#5F4E44] font-normal tracking-wide",children:ct.hero.supportingText}),S.jsxs("div",{className:"mt-7 sm:mt-8 flex flex-col sm:flex-row items-center gap-3.5 sm:gap-4 w-full sm:w-auto",children:[S.jsxs(Ft,{to:ct.hero.primaryCta.href,className:"w-full sm:w-auto px-7 py-3.5 rounded-full bg-[#1C1510] hover:bg-[#32231A] text-[#FAF7F2] text-xs sm:text-sm font-semibold tracking-wider uppercase shadow-lg shadow-black/10 transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center gap-2.5",children:[S.jsx("span",{children:ct.hero.primaryCta.label}),S.jsx(Ri,{className:"w-4 h-4 text-[#E8C7A8]"})]}),S.jsxs("button",{type:"button",onClick:()=>{i?i(ct.hero.secondaryCta.targetId):document.getElementById(ct.hero.secondaryCta.targetId)?.scrollIntoView({behavior:"smooth"})},className:"w-full sm:w-auto px-6 py-3.5 rounded-full bg-white/60 hover:bg-white/90 backdrop-blur-md border border-[#E0D4C3] text-[#2B1B12] text-xs sm:text-sm font-semibold tracking-wider uppercase shadow-sm transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 cursor-pointer",children:[S.jsx("span",{children:ct.hero.secondaryCta.label}),S.jsx(yl,{className:"w-4 h-4 text-[#8B776A]"})]})]}),S.jsxs("div",{className:"mt-5 sm:mt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-[11px] font-medium text-[#7C6A5E]",children:[S.jsxs("span",{className:"flex items-center gap-1.5",children:[S.jsx(jr,{className:"w-3.5 h-3.5 text-[#B76E79]"}),"Silk Mark Certified"]}),S.jsx("span",{className:"hidden sm:inline-block opacity-40",children:"•"}),S.jsxs("span",{className:"flex items-center gap-1.5",children:[S.jsx(Tl,{className:"w-3.5 h-3.5 text-[#B76E79]"}),"Three Karnataka Showrooms"]}),S.jsx("span",{className:"hidden sm:inline-block opacity-40",children:"•"}),S.jsxs("span",{className:"flex items-center gap-1.5",children:[S.jsx(vo,{className:"w-3.5 h-3.5 text-[#B76E79]"}),"Private Family Suites"]})]})]}),S.jsx("div",{className:"relative z-20 w-full max-w-xl mx-auto mt-10 sm:mt-12 transition-transform duration-300 ease-out",style:{transform:`translate3d(${u.x*-.6}px, ${u.y*-.6}px, 20px) rotateX(${u.y*-.3}deg) rotateY(${u.x*-.3}deg)`},onMouseEnter:()=>l(!0),onMouseLeave:()=>l(!1),children:S.jsxs("div",{className:`relative overflow-hidden rounded-3xl bg-white/75 backdrop-blur-2xl border border-white/60 p-5 sm:p-6 shadow-[0_25px_60px_rgba(28,21,16,0.15)] transition-all duration-500 transform ${r?"opacity-0 scale-[0.98] blur-[2px]":"opacity-100 scale-100 blur-0"}`,children:[S.jsxs("div",{className:"flex items-center justify-between gap-3 mb-3",children:[S.jsxs("span",{className:"inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1C1510] text-[#E8C7A8] text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.14em]",children:[S.jsx(So,{className:"w-3 h-3 text-[#E8C7A8]"}),b.tag]}),S.jsxs("div",{className:"flex items-center gap-1.5",children:[S.jsx("button",{type:"button",onClick:g,className:"w-7 h-7 rounded-full bg-[#FAF7F2] hover:bg-white text-[#4A173A] border border-[#E8DFC8] flex items-center justify-center transition-colors cursor-pointer","aria-label":"Previous Highlight",children:S.jsx(wl,{className:"w-3.5 h-3.5"})}),S.jsx("button",{type:"button",onClick:d,className:"w-7 h-7 rounded-full bg-[#FAF7F2] hover:bg-white text-[#4A173A] border border-[#E8DFC8] flex items-center justify-center transition-colors cursor-pointer","aria-label":"Next Highlight",children:S.jsx(Al,{className:"w-3.5 h-3.5"})})]})]}),S.jsxs("div",{className:"text-left space-y-1.5",children:[S.jsxs("div",{className:"flex items-baseline justify-between gap-2",children:[S.jsx("h3",{className:"font-serif text-lg sm:text-xl font-bold text-[#1C1510]",children:b.title}),b.stat&&S.jsx("span",{className:"text-xs font-bold text-[#B76E79] tracking-wider uppercase font-mono",children:b.stat})]}),S.jsx("p",{className:"text-xs font-semibold text-[#8B5A72] tracking-wide",children:b.subtitle}),S.jsx("p",{className:"text-xs sm:text-[13px] leading-relaxed text-[#5F4E44] pt-1",children:b.description}),S.jsxs("div",{className:"pt-2 flex items-center justify-between text-[11px] font-semibold text-[#4A173A] border-t border-[#E8DFC8]/60 mt-3",children:[S.jsxs("span",{className:"flex items-center gap-1 text-[#B76E79]",children:["✓ ",b.highlight]}),S.jsxs("span",{className:"text-[10px] text-[#A69385] tracking-widest uppercase",children:[n+1," of ",t.length]})]})]}),S.jsx("div",{className:"flex items-center justify-center gap-1.5 mt-4 pt-2",children:t.map((E,C)=>S.jsx("button",{type:"button",onClick:()=>x(C),className:`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${C===n?"w-7 bg-[#1C1510]":"w-1.5 bg-[#D9CBBC] hover:bg-[#A69385]"}`,"aria-label":`View card ${C+1}`},E.id))})]})})]})}function Sm(){const{legacy:i}=ct,e=i.timeline||i.milestones||[];return S.jsx("section",{id:"legacy",className:"py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-t border-[#E8DFC8]/60 bg-[#FAF7F2] select-none [perspective:1200px]",children:S.jsxs("div",{className:"max-w-6xl mx-auto",children:[S.jsxs("div",{className:"text-center max-w-2xl mx-auto mb-16 sm:mb-20",children:[S.jsx("span",{className:"text-[10px] sm:text-xs font-bold tracking-[0.2em] uppercase text-[#B76E79]",children:i.kicker}),S.jsx("h2",{className:"font-serif text-3xl sm:text-5xl font-medium text-[#1A120C] mt-2.5",children:i.title}),S.jsx("p",{className:"text-sm sm:text-base text-[#6F5F53] mt-3 font-normal leading-relaxed",children:i.subtitle})]}),S.jsxs("div",{className:"grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center",children:[S.jsx("div",{className:"lg:col-span-6 relative [transform-style:preserve-3d] transition-transform duration-500 hover:[transform:rotateY(-3deg)_rotateX(2deg)]",children:S.jsxs("div",{className:"relative rounded-3xl overflow-hidden shadow-2xl border-2 border-[#E8DFC8]",children:[S.jsx("img",{src:"/images/floor.webp",alt:"BSC Textiles showroom floor",className:"w-full h-[380px] sm:h-[480px] object-cover hover:scale-105 transition-transform duration-700 ease-out",loading:"lazy"}),S.jsx("div",{className:"absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"}),S.jsxs("div",{className:"absolute bottom-6 left-6 right-6 p-4 sm:p-5 rounded-2xl bg-white/85 backdrop-blur-xl border border-white/60 shadow-xl flex items-center justify-between [transform:translateZ(24px)]",children:[S.jsxs("div",{children:[S.jsx("p",{className:"text-[10px] uppercase tracking-wider font-bold text-[#8B5A72]",children:"Silk Mark Certified"}),S.jsx("p",{className:"font-serif text-sm sm:text-base font-bold text-[#1C1510]",children:"Authentic Handlooms Since 1938"}),S.jsx("p",{className:"text-[11px] text-[#5F4E44] mt-0.5",children:"Tested at the counter before elders and family"})]}),S.jsx("div",{className:"w-12 h-12 rounded-full bg-[#1C1510] text-[#E8C7A8] flex items-center justify-center font-serif text-xs sm:text-sm font-bold shadow-md shrink-0 ml-3",children:"86y"})]})]})}),S.jsxs("div",{className:"lg:col-span-6 space-y-6",children:[S.jsx("div",{className:"space-y-4 text-xs sm:text-sm md:text-base leading-relaxed text-[#5F4E44]",children:i.bodyParagraphs.map((t,n)=>S.jsx("p",{children:t},n))}),S.jsx("div",{className:"pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4",children:e.map((t,n)=>S.jsxs("div",{className:"p-4 sm:p-5 rounded-2xl bg-white/80 backdrop-blur-sm border border-[#E8DFC8] shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-[#B76E79]/50",children:[S.jsxs("div",{className:"flex items-center justify-between mb-1",children:[S.jsx("span",{className:"font-mono text-xs font-bold text-[#B76E79]",children:t.year}),t.city&&S.jsxs("span",{className:"text-[10px] font-bold uppercase tracking-wider text-[#8B5A72] flex items-center gap-1",children:[S.jsx(Kr,{className:"w-3 h-3 text-[#B76E79]"}),t.city]})]}),S.jsx("h4",{className:"font-serif text-sm font-bold text-[#1C1510]",children:t.title}),S.jsx("p",{className:"text-[11px] text-[#6F5F53] leading-normal mt-1",children:t.desc})]},n))}),S.jsx("div",{className:"pt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-[#E8DFC8]",children:i.stats.map((t,n)=>S.jsxs("div",{className:"text-center sm:text-left",children:[S.jsx("div",{className:"font-serif text-2xl sm:text-3xl font-bold text-[#1C1510]",children:t.value}),S.jsx("div",{className:"text-xs font-bold text-[#4A173A] mt-0.5",children:t.label}),S.jsx("div",{className:"text-[10px] text-[#8B776A] mt-0.5",children:t.sub})]},n))})]})]})]})})}const Mm=["All Collections","Sarees","Couture","Menswear","Suits","Home & Bath","Jewellery"];function bm(){const{collectionsOverview:i}=ct,[e,t]=at.useState("All Collections"),n=i.items.filter(s=>e==="All Collections"?!0:e==="Sarees"?s.id==="sarees"||s.id==="wedding-coll":e==="Couture"?s.id==="womenswear"||s.id==="kids"||s.id==="dozolo":e==="Menswear"?s.id==="menswear"||s.id==="brands":e==="Suits"?s.id==="suits":e==="Home & Bath"?s.id==="home"||s.id==="towels":e==="Jewellery"?s.id==="jewellery"||s.id==="other":!0);return S.jsx("section",{id:"collections",className:"py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-t border-[#E8DFC8]/60 bg-[#F5EFE6]/60 select-none [perspective:1200px]",children:S.jsxs("div",{className:"max-w-7xl mx-auto",children:[S.jsxs("div",{className:"flex flex-col md:flex-row md:items-end justify-between mb-8 sm:mb-12",children:[S.jsxs("div",{className:"max-w-2xl",children:[S.jsx("span",{className:"text-[10px] sm:text-xs font-bold tracking-[0.2em] uppercase text-[#B76E79]",children:i.kicker}),S.jsx("h2",{className:"font-serif text-3xl sm:text-5xl font-medium text-[#1A120C] mt-2.5",children:i.title}),S.jsx("p",{className:"text-sm sm:text-base text-[#6F5F53] mt-3 font-normal leading-relaxed",children:i.subtitle})]}),S.jsx("div",{className:"mt-4 md:mt-0",children:S.jsxs(Ft,{to:"/wedding/customer-registration",className:"inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1C1510] text-[#FAF7F2] text-xs font-semibold tracking-wider uppercase shadow-md hover:bg-[#32231A] transition-colors",children:[S.jsx("span",{children:"Book Floor Appointment"}),S.jsx(_o,{className:"w-3.5 h-3.5 text-[#E8C7A8]"})]})})]}),S.jsx("div",{className:"flex flex-wrap items-center gap-2 mb-10 pb-2 overflow-x-auto no-scrollbar",children:Mm.map(s=>S.jsx("button",{type:"button",onClick:()=>t(s),className:`px-4 py-2 rounded-full text-xs font-bold tracking-wider uppercase transition-all duration-300 cursor-pointer ${e===s?"bg-[#1C1510] text-[#FAF7F2] shadow-md scale-105":"bg-white/70 text-[#6F5F53] hover:bg-white hover:text-[#1C1510] border border-[#E8DFC8]"}`,children:s},s))}),S.jsx("div",{className:"grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8",children:n.map(s=>S.jsxs("div",{className:"group relative rounded-3xl overflow-hidden bg-white/80 backdrop-blur-sm border border-[#E8DFC8] shadow-md hover:shadow-2xl transition-all duration-500 flex flex-col hover:-translate-y-2 [transform-style:preserve-3d]",children:[S.jsxs("div",{className:"relative h-64 sm:h-72 overflow-hidden bg-[#E8DFC8]/30",children:[S.jsx("img",{src:s.image,alt:s.title,className:"w-full h-full object-cover group-hover:scale-108 transition-transform duration-700 ease-out",loading:"lazy"}),S.jsx("div",{className:"absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent opacity-80 group-hover:opacity-95 transition-opacity"}),S.jsx("div",{className:"absolute top-4 left-4",children:S.jsx("span",{className:"px-3 py-1 rounded-full bg-white/90 backdrop-blur-md text-[10px] font-bold tracking-wider uppercase text-[#1C1510] shadow-sm",children:s.tag})}),S.jsx("div",{className:"absolute top-4 right-4",children:S.jsx("span",{className:"font-mono text-xs font-bold text-white/90",children:s.code})}),S.jsxs("div",{className:"absolute bottom-4 left-4 right-4 text-white [transform:translateZ(18px)]",children:[S.jsx("p",{className:"text-[10px] tracking-wider uppercase text-[#E8C7A8] font-bold",children:s.category}),S.jsx("h3",{className:"font-serif text-lg font-bold leading-tight mt-0.5",children:s.title})]})]}),S.jsxs("div",{className:"p-5 flex-1 flex flex-col justify-between space-y-4",children:[S.jsx("p",{className:"text-xs text-[#5F4E44] leading-relaxed",children:s.description}),s.details&&s.details.length>0&&S.jsx("div",{className:"pt-2 border-t border-[#E8DFC8]/60 space-y-1.5",children:s.details.slice(0,3).map((r,a)=>S.jsxs("div",{className:"flex items-center gap-1.5 text-[11px] text-[#6F5F53]",children:[S.jsx(Cl,{className:"w-3 h-3 text-[#B76E79] shrink-0"}),S.jsx("span",{className:"truncate",children:r})]},a))})]})]},s.id))})]})})}function Em(){const{weddingExperience:i}=ct;return S.jsx("section",{id:"wedding",className:"py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-t border-[#E8DFC8]/60 bg-[#FAF7F2]",children:S.jsx("div",{className:"max-w-7xl mx-auto",children:S.jsxs("div",{className:"relative rounded-[32px] sm:rounded-[40px] overflow-hidden bg-[#1C1510] text-[#FAF7F2] p-8 sm:p-14 lg:p-20 shadow-2xl border-2 border-[#32231A]",children:[S.jsx("div",{className:"absolute inset-0 opacity-20 bg-cover bg-center pointer-events-none mix-blend-luminosity",style:{backgroundImage:"url('/images/wedding.webp')"},"aria-hidden":"true"}),S.jsx("div",{className:"absolute inset-0 bg-gradient-to-r from-[#1C1510] via-[#1C1510]/95 to-[#1C1510]/70 pointer-events-none"}),S.jsxs("div",{className:"relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center",children:[S.jsxs("div",{className:"lg:col-span-7 space-y-6",children:[S.jsxs("div",{className:"inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[#E8C7A8] text-[10px] sm:text-xs font-bold tracking-[0.16em] uppercase",children:[S.jsx(vo,{className:"w-3.5 h-3.5 text-[#E8C7A8]"}),i.kicker]}),S.jsx("h2",{className:"font-serif text-3xl sm:text-5xl lg:text-6xl font-medium leading-[1.08] tracking-tight",children:i.title}),S.jsx("p",{className:"text-sm sm:text-base text-[#D4C3B5] leading-relaxed max-w-xl font-light",children:i.subtitle}),S.jsx("div",{className:"pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4",children:i.features.map((e,t)=>S.jsxs("div",{className:"p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-1.5",children:[S.jsxs("div",{className:"flex items-center gap-2",children:[S.jsx("span",{className:"w-2 h-2 rounded-full bg-[#B76E79]"}),S.jsx("h4",{className:"font-serif text-sm font-bold text-[#FAF7F2]",children:e.title})]}),S.jsx("p",{className:"text-xs text-[#B5A599] leading-relaxed",children:e.desc})]},t))}),S.jsxs("div",{className:"pt-4 flex flex-col sm:flex-row items-center gap-4",children:[S.jsxs(Ft,{to:i.cta.href,className:"w-full sm:w-auto px-8 py-4 rounded-full bg-[#B76E79] hover:bg-[#A85F6A] text-white text-xs sm:text-sm font-bold tracking-wider uppercase shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center gap-2.5",children:[S.jsx("span",{children:i.cta.label}),S.jsx(Ri,{className:"w-4 h-4"})]}),S.jsx("span",{className:"text-xs text-[#A69385] tracking-wide",children:"Zero waiting · Reserved family suites"})]})]}),S.jsx("div",{className:"lg:col-span-5 relative",children:S.jsxs("div",{className:"relative rounded-3xl overflow-hidden shadow-2xl border-2 border-[#E8DFC8]/30",children:[S.jsx("img",{src:"/images/coll-bridal-1200.webp",alt:"Bridal Silk Consultation",className:"w-full h-[360px] sm:h-[420px] object-cover",loading:"lazy"}),S.jsxs("div",{className:"absolute bottom-6 left-6 right-6 p-4 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/20 text-white shadow-xl space-y-1",children:[S.jsx("span",{className:"text-[10px] uppercase font-bold text-[#E8C7A8] tracking-widest",children:"Exclusive Hospitality"}),S.jsx("p",{className:"font-serif text-sm font-bold",children:"Private Bridal Suite 01"}),S.jsx("p",{className:"text-[11px] text-[#D4C3B5]",children:"Personalized stylist, family seating & pure zari inspection."})]})]})})]})]})})})}function ym(){const{stores:i}=ct,[e,t]=at.useState(i[0].id),n=s=>{window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s)}`,"_blank","noopener,noreferrer")};return S.jsx("section",{id:"stores",className:"py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-t border-[#E8DFC8]/60 bg-[#FAF7F2] select-none [perspective:1200px]",children:S.jsxs("div",{className:"max-w-7xl mx-auto",children:[S.jsxs("div",{className:"text-center max-w-2xl mx-auto mb-12 sm:mb-16",children:[S.jsx("span",{className:"text-[10px] sm:text-xs font-bold tracking-[0.2em] uppercase text-[#B76E79]",children:"THREE FLAGSHIP DESTINATIONS"}),S.jsx("h2",{className:"font-serif text-3xl sm:text-5xl font-medium text-[#1A120C] mt-2.5",children:"Visit Our Showrooms"}),S.jsx("p",{className:"text-sm sm:text-base text-[#6F5F53] mt-3 font-normal leading-relaxed",children:"Experience Karnataka’s foremost textile and wedding floors across Davanagere, Belagavi, and Shivamogga."})]}),S.jsx("div",{className:"flex items-center justify-center gap-2 mb-10",children:i.map(s=>S.jsx("button",{type:"button",onClick:()=>t(s.id),className:`px-5 py-2.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all duration-300 cursor-pointer ${e===s.id?"bg-[#1C1510] text-[#FAF7F2] shadow-md scale-105":"bg-white/70 text-[#6F5F53] hover:bg-white hover:text-[#1C1510] border border-[#E8DFC8]"}`,children:s.city.split(" ")[0]},s.id))}),S.jsx("div",{className:"grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-10 [transform-style:preserve-3d]",children:i.map(s=>{const r=e===s.id;return S.jsxs("div",{onClick:()=>t(s.id),className:`rounded-3xl overflow-hidden bg-white/85 backdrop-blur-md border transition-all duration-500 flex flex-col justify-between cursor-pointer ${r?"border-[#B76E79] shadow-2xl scale-[1.02] [transform:translateZ(20px)] ring-2 ring-[#B76E79]/20":"border-[#E8DFC8] shadow-md opacity-90 hover:opacity-100 hover:shadow-xl"}`,children:[S.jsxs("div",{children:[S.jsxs("div",{className:"relative h-56 sm:h-64 overflow-hidden bg-[#E8DFC8]/20",children:[S.jsx("img",{src:s.image,alt:s.city,className:"w-full h-full object-cover hover:scale-108 transition-transform duration-700 ease-out",loading:"lazy"}),S.jsx("div",{className:"absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"}),S.jsx("div",{className:"absolute top-4 left-4",children:S.jsx("span",{className:"px-3 py-1 rounded-full bg-white/90 backdrop-blur-md text-[10px] font-bold tracking-wider uppercase text-[#1C1510] shadow-sm",children:s.established})}),S.jsxs("div",{className:"absolute bottom-4 left-4 right-4 text-white",children:[S.jsx("span",{className:"text-[10px] uppercase tracking-wider text-[#E8C7A8] font-bold",children:s.badge}),S.jsx("h3",{className:"font-serif text-xl font-bold leading-tight mt-0.5",children:s.city})]})]}),S.jsxs("div",{className:"p-6 space-y-4",children:[S.jsxs("div",{className:"space-y-2.5 text-xs text-[#5F4E44]",children:[S.jsxs("div",{className:"flex items-start gap-2.5",children:[S.jsx(Kr,{className:"w-4 h-4 text-[#B76E79] shrink-0 mt-0.5"}),S.jsx("span",{className:"leading-relaxed",children:s.address})]}),S.jsxs("div",{className:"flex items-center gap-2.5",children:[S.jsx(Rl,{className:"w-4 h-4 text-[#B76E79] shrink-0"}),S.jsx("a",{href:`tel:${s.phone.replace(/\s+/g,"")}`,className:"font-semibold text-[#1C1510] hover:underline",children:s.phone})]}),s.email&&S.jsxs("div",{className:"flex items-center gap-2.5",children:[S.jsx(Pl,{className:"w-4 h-4 text-[#B76E79] shrink-0"}),S.jsx("span",{className:"font-medium text-[#1C1510]",children:s.email})]}),S.jsxs("div",{className:"flex items-center gap-2.5",children:[S.jsx(Nl,{className:"w-4 h-4 text-[#B76E79] shrink-0"}),S.jsx("span",{children:s.hours})]})]}),S.jsxs("div",{className:"pt-3 border-t border-[#E8DFC8]/60",children:[S.jsx("p",{className:"text-[10px] uppercase font-bold tracking-wider text-[#8B5A72] mb-2",children:"Featured Departments"}),S.jsx("div",{className:"flex flex-wrap gap-1.5",children:s.departments.map((a,o)=>S.jsx("span",{className:"px-2.5 py-1 rounded-full bg-[#FAF7F2] border border-[#E8DFC8] text-[11px] font-medium text-[#4A173A]",children:a},o))})]})]})]}),S.jsxs("div",{className:"p-6 pt-0 flex items-center gap-3",children:[S.jsxs("button",{type:"button",onClick:a=>{a.stopPropagation(),n(s.mapsQuery)},className:"flex-1 py-2.5 rounded-full border border-[#D5C6B5] hover:bg-[#FAF7F2] text-[#1C1510] text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer",children:[S.jsx(Ll,{className:"w-3.5 h-3.5 text-[#B76E79]"}),S.jsx("span",{children:"Get Directions"})]}),S.jsxs(Ft,{to:"/wedding/customer-registration",onClick:a=>a.stopPropagation(),className:"px-4 py-2.5 rounded-full bg-[#1C1510] hover:bg-[#32231A] text-[#FAF7F2] text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1 shadow-sm",children:[S.jsx("span",{children:"Book"}),S.jsx(Ri,{className:"w-3.5 h-3.5 text-[#E8C7A8]"})]})]})]},s.id)})})]})})}function Tm(){const{shivamoggaEvent:i}=ct,e=()=>{window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(i.cta.mapsQuery)}`,"_blank","noopener,noreferrer")};return S.jsx("section",{id:"shivamogga-event",className:"py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-t border-[#E8DFC8]/60 bg-[#F5EFE6]/70",children:S.jsx("div",{className:"max-w-7xl mx-auto",children:S.jsxs("div",{className:"relative rounded-[32px] sm:rounded-[44px] overflow-hidden bg-[#1A120C] text-[#FAF7F2] p-8 sm:p-14 lg:p-20 shadow-2xl border-2 border-[#38271C]",children:[S.jsx("div",{className:"absolute inset-0 bg-cover bg-center opacity-30 mix-blend-luminosity scale-105 transition-transform duration-1000",style:{backgroundImage:"url('/images/suit.webp')"},"aria-hidden":"true"}),S.jsx("div",{className:"absolute inset-0 bg-gradient-to-t from-[#1A120C] via-[#1A120C]/80 to-transparent"}),S.jsxs("div",{className:"relative z-10 max-w-3xl space-y-6",children:[S.jsxs("div",{className:"inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#E8C7A8]/15 border border-[#E8C7A8]/30 text-[#E8C7A8] text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em]",children:[S.jsx(So,{className:"w-3.5 h-3.5 text-[#E8C7A8]"}),i.kicker]}),S.jsx("h2",{className:"font-serif text-3xl sm:text-5xl lg:text-6xl font-medium leading-[1.06] tracking-tight",children:i.title}),S.jsx("p",{className:"text-sm sm:text-base text-[#D4C3B5] leading-relaxed font-light",children:i.description}),S.jsxs("div",{className:"p-6 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl space-y-4 my-6",children:[S.jsxs("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-4",children:[S.jsxs("div",{className:"flex items-start gap-3",children:[S.jsx(Mo,{className:"w-5 h-5 text-[#E8C7A8] shrink-0 mt-0.5"}),S.jsxs("div",{children:[S.jsx("span",{className:"text-[10px] uppercase font-bold tracking-wider text-[#A69385]",children:"Inaugural Season"}),S.jsx("p",{className:"font-serif text-sm font-bold text-white",children:i.date})]})]}),S.jsxs("div",{className:"flex items-start gap-3",children:[S.jsx(Kr,{className:"w-5 h-5 text-[#E8C7A8] shrink-0 mt-0.5"}),S.jsxs("div",{children:[S.jsx("span",{className:"text-[10px] uppercase font-bold tracking-wider text-[#A69385]",children:"Location"}),S.jsx("p",{className:"text-xs text-[#D4C3B5] leading-relaxed",children:i.venue})]})]})]}),S.jsx("div",{className:"pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-2.5",children:i.highlights.map((t,n)=>S.jsxs("div",{className:"flex items-center gap-2 text-xs text-[#E8DFC8]",children:[S.jsx("span",{className:"w-1.5 h-1.5 rounded-full bg-[#B76E79]"}),S.jsx("span",{children:t})]},n))})]}),S.jsxs("div",{className:"flex flex-col sm:flex-row items-center gap-4 pt-2",children:[S.jsxs("button",{type:"button",onClick:e,className:"w-full sm:w-auto px-7 py-3.5 rounded-full bg-[#FAF7F2] hover:bg-white text-[#1C1510] text-xs font-bold uppercase tracking-wider shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center gap-2",children:[S.jsx("span",{children:i.cta.label}),S.jsx(Ri,{className:"w-4 h-4 text-[#B76E79]"})]}),S.jsx(Ft,{to:"/wedding/customer-registration",className:"w-full sm:w-auto px-6 py-3.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-[#FAF7F2] text-xs font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2",children:S.jsx("span",{children:"Register for Wedding Visit"})})]})]})]})})})}function wm(){const{about:i}=ct;return S.jsx("section",{id:"about",className:"py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-t border-[#E8DFC8]/60 bg-[#FAF7F2]",children:S.jsxs("div",{className:"max-w-6xl mx-auto",children:[S.jsxs("div",{className:"text-center max-w-3xl mx-auto mb-16",children:[S.jsx("span",{className:"text-[10px] sm:text-xs font-bold tracking-[0.2em] uppercase text-[#B76E79]",children:i.kicker}),S.jsx("h2",{className:"font-serif text-3xl sm:text-5xl font-medium text-[#1A120C] mt-2.5",children:i.title}),S.jsxs("blockquote",{className:"mt-6 p-6 rounded-3xl bg-white/70 backdrop-blur-md border border-[#E8DFC8] font-serif italic text-base sm:text-lg text-[#4A173A] leading-relaxed shadow-sm",children:[i.quote,S.jsxs("footer",{className:"mt-3 text-xs not-italic uppercase tracking-widest text-[#B76E79] font-sans font-bold",children:["— ",i.author]})]})]}),S.jsx("div",{className:"grid grid-cols-1 md:grid-cols-3 gap-8",children:i.points.map((e,t)=>S.jsxs("div",{className:"p-8 rounded-3xl bg-white/80 border border-[#E8DFC8] shadow-md hover:shadow-xl transition-shadow flex flex-col justify-between space-y-4",children:[S.jsxs("div",{className:"space-y-3",children:[S.jsxs("div",{className:"w-10 h-10 rounded-2xl bg-[#FAF7F2] border border-[#E8DFC8] flex items-center justify-center text-[#B76E79]",children:[t===0&&S.jsx(Dl,{className:"w-5 h-5"}),t===1&&S.jsx(jr,{className:"w-5 h-5"}),t===2&&S.jsx(Il,{className:"w-5 h-5"})]}),S.jsx("h3",{className:"font-serif text-lg font-bold text-[#1C1510]",children:e.title}),S.jsx("p",{className:"text-xs sm:text-sm text-[#5F4E44] leading-relaxed",children:e.desc})]}),S.jsx("div",{className:"pt-4 border-t border-[#E8DFC8]/60 text-[11px] font-bold text-[#8B5A72] uppercase tracking-wider",children:"BSC Guarantee"})]},t))})]})})}function Am(){const{contact:i}=ct;return S.jsx("section",{id:"contact",className:"py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-t border-[#E8DFC8]/60 bg-[#F5EFE6]/50",children:S.jsxs("div",{className:"max-w-7xl mx-auto",children:[S.jsxs("div",{className:"text-center max-w-2xl mx-auto mb-16",children:[S.jsx("span",{className:"text-[10px] sm:text-xs font-bold tracking-[0.2em] uppercase text-[#B76E79]",children:i.kicker}),S.jsx("h2",{className:"font-serif text-3xl sm:text-5xl font-medium text-[#1A120C] mt-2.5",children:i.title}),S.jsx("p",{className:"text-sm sm:text-base text-[#6F5F53] mt-3 font-normal leading-relaxed",children:i.subtitle})]}),S.jsx("div",{className:"grid grid-cols-1 md:grid-cols-3 gap-8",children:i.cards.map((e,t)=>S.jsxs("div",{className:"p-8 rounded-3xl bg-white/85 backdrop-blur-md border border-[#E8DFC8] shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between",children:[S.jsxs("div",{className:"space-y-4",children:[S.jsxs("div",{className:"w-12 h-12 rounded-2xl bg-[#1C1510] text-[#E8C7A8] flex items-center justify-center shadow-sm",children:[e.icon==="calendar"&&S.jsx(Mo,{className:"w-5 h-5"}),e.icon==="message"&&S.jsx(Ul,{className:"w-5 h-5"}),e.icon==="briefcase"&&S.jsx(Fl,{className:"w-5 h-5"})]}),S.jsx("h3",{className:"font-serif text-xl font-bold text-[#1C1510]",children:e.title}),S.jsx("p",{className:"text-xs sm:text-sm text-[#5F4E44] leading-relaxed",children:e.info})]}),S.jsx("div",{className:"pt-6 mt-6 border-t border-[#E8DFC8]/60",children:S.jsxs(Ft,{to:e.href,className:"w-full py-3 rounded-full bg-[#FAF7F2] hover:bg-[#1C1510] text-[#1C1510] hover:text-[#FAF7F2] border border-[#D5C6B5] hover:border-[#1C1510] text-xs font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 group",children:[S.jsx("span",{children:e.actionLabel}),S.jsx(Ri,{className:"w-4 h-4 text-[#B76E79] group-hover:text-[#E8C7A8] transition-colors"})]})})]},t))})]})})}function Cm(){const i=()=>{window.scrollTo({top:0,behavior:"smooth"})};return S.jsx("footer",{className:"bg-[#140D08] text-[#FAF7F2] border-t-2 border-[#2A1D13] pt-16 pb-12 px-4 sm:px-6 lg:px-8 select-none",children:S.jsxs("div",{className:"max-w-7xl mx-auto space-y-12",children:[S.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-12 gap-10 border-b border-[#2A1D13] pb-12",children:[S.jsxs("div",{className:"md:col-span-4 space-y-4",children:[S.jsxs("div",{className:"flex items-center gap-3",children:[S.jsx("div",{className:"p-1 rounded-xl bg-white/10 border border-white/15",children:S.jsx("img",{src:"/Main_logo.png",alt:"BSC Textiles",className:"h-10 w-auto object-contain"})}),S.jsxs("div",{children:[S.jsx("span",{className:"font-serif tracking-widest text-base font-bold text-white uppercase block",children:"BSC TEXTILES"}),S.jsx("span",{className:"text-[10px] tracking-wider text-[#E8C7A8] uppercase",children:"FIVE GENERATIONS · ESTD 1938"})]})]}),S.jsx("p",{className:"text-xs text-[#A69385] leading-relaxed max-w-sm",children:"Karnataka’s premier textile house for pure silk sarees, bespoke tailoring, bridal trousseaus, and curated home furnishings."}),S.jsxs("div",{className:"inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-[#E8C7A8]",children:[S.jsx(jr,{className:"w-3.5 h-3.5 text-[#B76E79]"}),S.jsx("span",{children:"Silk Mark Organization of India Member"})]})]}),S.jsxs("div",{className:"md:col-span-4 space-y-3",children:[S.jsx("h4",{className:"text-xs uppercase tracking-widest font-bold text-[#E8C7A8]",children:"Showroom Flagships"}),S.jsxs("ul",{className:"space-y-2 text-xs text-[#D4C3B5]",children:[S.jsxs("li",{children:[S.jsx("strong",{className:"text-white",children:"Belagavi:"})," Khade Bazar / Raviwar Peth, Tilakwadi"]}),S.jsxs("li",{children:[S.jsx("strong",{className:"text-white",children:"Davanagere:"})," Mandipet / PB Road, MCC B Block"]}),S.jsxs("li",{children:[S.jsx("strong",{className:"text-white",children:"Shivamogga:"})," Nehru Road / Durgigudi Main Road"]})]})]}),S.jsxs("div",{className:"md:col-span-4 space-y-3",children:[S.jsx("h4",{className:"text-xs uppercase tracking-widest font-bold text-[#E8C7A8]",children:"Navigation & Portals"}),S.jsxs("div",{className:"grid grid-cols-2 gap-2 text-xs text-[#D4C3B5]",children:[S.jsx("a",{href:"#hero",className:"hover:text-white transition-colors",children:"Home"}),S.jsx("a",{href:"#legacy",className:"hover:text-white transition-colors",children:"Our Legacy"}),S.jsx("a",{href:"#collections",className:"hover:text-white transition-colors",children:"Collections"}),S.jsx("a",{href:"#wedding",className:"hover:text-white transition-colors",children:"Wedding Suite"}),S.jsx("a",{href:"#stores",className:"hover:text-white transition-colors",children:"Stores"}),S.jsx("a",{href:"#shivamogga-event",className:"hover:text-white transition-colors",children:"Shivamogga"}),S.jsx(Ft,{to:"/wedding/customer-registration",className:"text-[#B76E79] hover:underline font-bold",children:"Wedding Register"}),S.jsx(Ft,{to:"/login",className:"hover:text-white transition-colors",children:"Staff Portal"})]})]})]}),S.jsxs("div",{className:"flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#8B776A]",children:[S.jsxs("div",{children:["© ",new Date().getFullYear()," BSC Textiles Private Limited. All rights reserved."]}),S.jsxs("button",{type:"button",onClick:i,className:"flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-[#FAF7F2] transition-colors cursor-pointer",children:[S.jsx("span",{children:"Back to top"}),S.jsx(Ol,{className:"w-3.5 h-3.5"})]})]})]})})}const Rm=["hero","legacy","collections","wedding","stores","shivamogga-event","about","contact"];function Dm(){const[i,e]=at.useState("hero"),[t,n]=at.useState(0),[s,r]=at.useState(!1);at.useEffect(()=>{const o=document.title;return document.title="BSC Textiles",()=>{document.title=o}},[]),at.useEffect(()=>{const o=!window.matchMedia("(pointer: fine)").matches,l=window.matchMedia("(prefers-reduced-motion: reduce)").matches;if(o||l)return;let c=null,u=0;try{c=new ql({duration:1.05,smoothWheel:!0,syncTouch:!1,wheelMultiplier:1,easing:d=>Math.min(1,1.001-Math.pow(2,-10*d))});const p=d=>{c?.raf(d),u=requestAnimationFrame(p)};u=requestAnimationFrame(p)}catch{c=null}return()=>{cancelAnimationFrame(u),c?.destroy()}},[]),at.useEffect(()=>{const o=()=>{const l=window.scrollY||0;n(l);const c=l+200;for(const u of Rm){const p=document.getElementById(u);if(p){const d=p.offsetTop,g=p.offsetHeight;if(c>=d&&c<d+g){e(u);break}}}};return window.addEventListener("scroll",o,{passive:!0}),()=>window.removeEventListener("scroll",o)},[]);const a=at.useCallback(o=>{const l=document.getElementById(o);l&&l.scrollIntoView({behavior:"smooth"})},[]);return S.jsxs("div",{className:"relative min-h-screen w-full bg-[#120B07] text-[#2B1722] selection:bg-[#B76E79] selection:text-white",children:[S.jsx(_m,{onComplete:()=>r(!0)}),S.jsx(xm,{scrollY:t}),S.jsxs("div",{className:"bsc-outer-env","aria-hidden":"true",children:[S.jsx("img",{src:"/images/floor.webp",alt:"",className:"bsc-outer-bg-img",loading:"eager",decoding:"async"}),S.jsx("div",{className:"bsc-outer-vignette"})]}),S.jsx("div",{className:"relative z-10 py-3 sm:py-6 lg:py-8",children:S.jsxs("div",{className:"bsc-main-window-frame",children:[S.jsx(Yl,{activeSection:i,onNavigate:a}),S.jsxs("main",{id:"main-content",className:"flex flex-col",children:[S.jsx(vm,{onScrollTo:a,scrollY:t}),S.jsx(Sm,{}),S.jsx(bm,{}),S.jsx(Em,{}),S.jsx(ym,{}),S.jsx(Tm,{}),S.jsx(wm,{}),S.jsx(Am,{})]}),S.jsx(Cm,{})]})})]})}export{Dm as default};
