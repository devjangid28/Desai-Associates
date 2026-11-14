let control = false;
///is_mobile
let is_mobile = (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))
if(window.innerWidth<=950) is_mobile = true;
// is_mobile = false;

//get browser
const is_mac = (/Mac/i.test(navigator.userAgent))
const is_safari = (/Safari/i.test(navigator.userAgent))
const is_iphone = (/iPhone/i.test(navigator.userAgent))
const is_ios = (/iPhone|iPad|iPod/i.test(navigator.userAgent))

///get size
let is_xxl = (window.innerWidth<=1366)
let is_lg = (window.innerWidth<=1024)
let is_md = (window.innerWidth<=768)
let is_sm = (window.innerWidth<=576)
let is_xs = (window.innerWidth<=468)

///get Index of elemnt
const getInd = (elem) => Array.from(elem.parentNode.children).indexOf(elem);
///get getComputedStyle
const getStyle = (elem) => window.getComputedStyle(elem) || elem.currentStyle;
///get em
const em = () => parseInt(window.getComputedStyle(document.getElementsByTagName('body')[0], null).getPropertyValue('font-size')) ;

if(control) console.log('is_mobile',is_mobile);
if(control) console.log('is_md',is_md)


// vars
const htmlEl = document.querySelector("html");
const header = document.querySelector('.header');
const header_logo = document.querySelector('.header__logo');
const header_logo_normal = header_logo.querySelector('.logo__normal');
const header_logo_group = header_logo.querySelector('.logo__group');
const menu = document.querySelector('.header__menu');
const btnAnchors = document.querySelector('.header__footer__btn');
const transition = document.querySelector(".transition");
const contacto = document.querySelector('.modal--contact');
const contacto_content = contacto.querySelector('.modal__content');
const posLogoMobile = (!is_mobile) ? 0 : '0.15em' ;
///
const timescale = 1.15;//1.15;
const lenisStop = true;

let swup, smoother, smoothWrapper, smoothContent, main, lenis, cursor, cursorSpan, openMenu, mousechanges,
triggersChapter = [], triggerNext, triggerHeaderLogo, triggerParallaxCierre, init_animations, last_animations, 
changeButtonAnchors, setScrollH, setSmooth, setClicks, setLink, setRollovers, setRolloverBtnBg, setRolloversMenu, 
removeRolloversMenu, menu_tl, anclas_tl, alert_tl, header_logo_tl, header_btn_tl, header_anchors_tl, scroll_tl, 
scroll_intro_tl, contacto_tl, chaptersAll, onlyOnce, onScroll, terms, setFlips, processResize = false;;

cursor = document.querySelector("#mouse");
cursorSpan = cursor.querySelector('span');
smoothWrapper = document.querySelector("#smooth-wrapper");
smoothContent = document.querySelector("#smooth-content");
main = document.querySelector('main');
chaptersAll = document.querySelectorAll('.mod-title--chapter.count');
terms = (document.querySelector('.mod-scroll__terms')) ? document.querySelector('.mod-scroll__terms') : undefined;
onlyOnce = false;
onScroll = false;

//gsap
gsap.registerPlugin(ScrollTrigger,ScrollSmoother,MorphSVGPlugin);
gsap.config({ nullTargetWarn: false, force3D: true });

///set if is safari
if(is_safari) htmlEl.classList.add('is_safari')

//recharge page on history browser
let pageShow = false
window.addEventListener( "pageshow", function (e) {  
    if(pageShow)
        window.location.reload();
    pageShow = true;
});

