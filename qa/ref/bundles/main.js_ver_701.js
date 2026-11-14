
document.addEventListener('DOMContentLoaded', () => {

    //setSmooth
    const setSmooth = () => {
        if(!is_mobile){

            // Initialize Lenis
            lenis = new Lenis();

            // Synchronize Lenis scrolling with GSAP's ScrollTrigger plugin
            lenis.on('scroll', ScrollTrigger.update);

            // Add Lenis's requestAnimationFrame (raf) method to GSAP's ticker
            // This ensures Lenis's smooth scroll animation updates on each GSAP tick
            gsap.ticker.add((time) => {
                lenis.raf(time * 1000); // Convert time from seconds to milliseconds
            });

            // Disable lag smoothing in GSAP to prevent any delay in scroll animations
            gsap.ticker.lagSmoothing(0);

            if(lenisStop) lenis.stop()

        }else{
            htmlEl.classList.add('mobile')
            ScrollTrigger.defaults({scroller: '#smooth-wrapper'});
        }
    }

    //follow mouse
    const setFollow = () => {

        //follow mouse
        //follow mouse
        //follow mouse
        let xSet, ySet, speed = 0.2;
        const initWidth = cursor.offsetWidth;
        const initHeight = cursor.offsetHeight;

        mouseChanges = () => {

            let textSpan;
            
            //expand mouse
            if(document.querySelectorAll('.expand_mouse').length){

                let widthExpand = '7.15rem', heightExpand = '7.15rem';
                if(is_lg){ widthExpand = '5.65rem',  heightExpand = '5.65rem' }

                const mouse_tl = gsap.timeline({paused:true})
                mouse_tl.fromTo(cursor,{width:initWidth, height:initHeight},{width:widthExpand, height:heightExpand, duration: .25, ease: 'back.out'},0)
                mouse_tl.to(cursorSpan,{opacity:1, duration: .35, ease: 'linear',
                    onStart: () => {
                        cursorSpan.innerHTML = textSpan;
                    },
                    onReverseComplete: () => {
                        cursorSpan.innerHTML = textSpan;
                    }
                },0)

                document.querySelectorAll('.expand_mouse').forEach( elem => {

                    elem.addEventListener("mouseover", e => {
                        textSpan = (elem.getAttribute('data-text')) ? elem.getAttribute('data-text') : '';
                        if(textSpan!=cursorSpan.innerHTML) cursorSpan.innerHTML = textSpan;
                        mouse_tl.play()
                    })
                    elem.addEventListener("mouseout", e => {
                        textSpan = '';
                        mouse_tl.reverse()
                    })
                    elem.addEventListener("click", e => {
                        if(elem.getAttribute('data-url')){
                            textSpan = '';
                            mouse_tl.reverse()
                            elem.querySelector('.btn--circle').click()
                            // const url = elem.getAttribute('data-url');
                            // swup.navigate(url)
                        }
                    })
        
                } )
            }

            //mod-scroll__terms
            if(document.querySelectorAll('.mod-scroll__terms').length){

                document.querySelectorAll('.mod-scroll__terms').forEach( elem => {

                    elem.addEventListener("mouseenter", e => {

                        gsap.fromTo(cursor,{scale:1, opacity:1},{scale:0, opacity:0, duration: .33, ease: 'power2.out'})
                        cursor = elem.querySelector('.follow__mouse')
                        gsap.fromTo(cursor,{scale:0, opacity:0},{scale:1, opacity:1, duration: .33, ease: 'power2.out'})
                        xSet = gsap.quickSetter(cursor, "x", "px");
                        ySet = gsap.quickSetter(cursor, "y", "px");
                    })
                    elem.addEventListener("mouseleave", e => {

                        gsap.fromTo(cursor,{scale:1, opacity:1},{scale:0, opacity:0, duration: .33, ease: 'power2.out'})
                        cursor = document.querySelector("#mouse")
                        gsap.fromTo(cursor,{scale:0, opacity:0},{scale:1, opacity:1, duration: .33, ease: 'power2.out'})
                        xSet = gsap.quickSetter(cursor, "x", "px");
                        ySet = gsap.quickSetter(cursor, "y", "px");
                    })

                })

            }
        }

        if(!is_mobile){

            const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
            const mouse = { x: pos.x, y: pos.y };
            xSet = gsap.quickSetter(cursor, "x", "px");
            ySet = gsap.quickSetter(cursor, "y", "px");

            gsap.ticker.add(() => {
                // adjust speed for higher refresh monitors
                const dt = 1.0 - Math.pow(1.0 - speed, gsap.ticker.deltaRatio()); 
                pos.x += (mouse.x - pos.x) * dt;
                pos.y += (mouse.y - pos.y) * dt;
                xSet(pos.x);
                ySet(pos.y);
            });
        
            
            window.addEventListener("mousemove", e => { 
                if(cursor == document.querySelector('.mod-scroll__terms .follow__mouse')){
                    mouse.x = e.x - terms.getBoundingClientRect().left;
                    mouse.y = e.y - terms.getBoundingClientRect().top;
                    speed = 0.1;
                }else{
                    mouse.x = e.x;
                    mouse.y = e.y;
                    speed = 0.2;
                }
                 
            });;

            mouseChanges();

        }
        //follow mouse
        //follow mouse
        //follow mouse

    }

    //setAspectRatio media
    const setAspectRatio = () => {
        if(document.querySelectorAll('.media').length > 0){
            document.querySelectorAll('.media:not(.noAspect)').forEach( elem => {
                
                const image = elem.querySelector('.media__source');

                const loadImage = new Image();
                loadImage.src = image.getAttribute('src');
                loadImage.onload = () => { 
                    const aspect = image.naturalWidth+'/'+image.naturalHeight;
                    // if(control) console.log('aspect: ',aspect);
                    elem.querySelector('.media__wrap-source').style.aspectRatio = aspect; 
                }
                
            } )
        }
    }
           
    //setSliders
    const setSliders = () => {
        if(document.querySelectorAll('.mod-media__slider').length){
            document.querySelectorAll('.mod-media__slider').forEach( elem => {
                const swiper = new Swiper(elem,{
                    loop: true,
                    centeredSlides: true,
                    slidesPerView: 4/3.6,
                    touchStartPreventDefault: false,
                    allowTouchMove: true,
                    breakpoints: {
                        768: {
                            slidesPerView: 12/9.15,
                        },
                    },
                    on: {
                        progress: function (e) {

                        }
                    },
                });

            } )
        }
    }

    //setFlips
    setFlips = () => {


        if(document.querySelectorAll('.flipMedia').length > 0){
            
            document.querySelectorAll('.flipMedia').forEach( (elem) => {

                const duration = (elem.getAttribute('data-duration')) ? parseInt(elem.getAttribute('data-duration')) : 1.5;
                
                const flipMedia_tl = gsap.timeline({paused:true});

                if(elem.classList.contains('flipMedia--leftRight')){
                    flipMedia_tl.to( elem.querySelector('.flipMedia__media--up'),{'--clipPath':'0% 100% 0% 0%', duration: duration, ease: 'power2.out'},0)
                    flipMedia_tl.from( elem.querySelector('.flipMedia__media--down .media__source'),{scale:'1.2', duration: duration+.5, ease: 'power2.out'},0)

                }else if(elem.classList.contains('flipMedia--rightLeft')){
                    flipMedia_tl.to( elem.querySelector('.flipMedia__media--up'),{'--clipPath':'0% 0% 0% 100%', duration: duration, ease: 'power2.out'},0)
                    flipMedia_tl.from( elem.querySelector('.flipMedia__media--down .media__source'),{scale:'1.2', duration: duration+.5, ease: 'power2.out'},0)

                }else if(elem.classList.contains('flipMedia--upDown')){
                    // console.log('flipMedia--upDown');
                    flipMedia_tl.to( elem.querySelector('.flipMedia__media--up'),{y:'-105%', duration: duration, ease: 'power3.out'},0)
                    flipMedia_tl.from( elem.querySelector('.flipMedia__media--down .media__source'),{y:'-10%', duration: duration+.5, ease: 'power3.out'},0)
                }

                let startTl = (elem.getAttribute('data-start')) ? elem.getAttribute('data-start') : "100% 100%";;
                let endTl = false;
                let triggerTl = elem;
                let scrubTl = false;

                ///values scroll cierre
                if(elem.classList.contains('mod-scroll__cierre__content__image')){

                    startTl = "0% 0%";
                    triggerTl = document.querySelector('.mod-scroll__cierre');
                    scrubTl = .33;
                    endTl = '+=50%';

                    if(is_mobile){
                        startTl = "0% 50%";
                        endTl = '+=100%'
                    } 

                    triggerFlipCierreImage = ScrollTrigger.create({
                        containerAnimation: scroll_tl,
                        animation: flipMedia_tl,
                        trigger: triggerTl,
                        start: startTl,
                        end: endTl,
                        scrub: scrubTl,
                        // toggleActions: 'play none none reverse',
                        // markers: true,
                        onRefresh: () => {
                            if(control) console.log('resize triggerFlipCierreImage');
                            
                        }
                    })

                }else{

                    ///values images proyectInt
                    if(elem.classList.contains('mod-scroll__projectInt__image') 
                            || elem.classList.contains('mod-scroll__projectInt__image-small')){
                        startTl = "75% 100%";
                        triggerTl = elem.closest('.mod-scroll__projectInt');
                        endTl = '+=75%';
                        scrubTl = .2;
                    }else if(elem.classList.contains('mod-header__content__img-sup') 
                        || elem.classList.contains('mod-header__content__img-inf') ){
                        startTl = "1% 0%";
                        triggerTl = elem.closest('.mod-header');
                        endTl = '+=75%';
                        scrubTl = .5;
                    }else{
                        endTl = '+=75%';
                        scrubTl = .35;   
                    }

                     ScrollTrigger.create({
                        containerAnimation: scroll_tl,
                        animation: flipMedia_tl,
                        trigger: triggerTl,
                        start: startTl,
                        end: endTl,
                        scrub: scrubTl,
                        // toggleActions: 'play none none reverse',
                        // markers: true,
                    })

                }

                

                
                
            })
            
        }
    }
    
    // generate videos
    const generateVideos = () => {
        if(document.querySelectorAll('video:not([src])').length){
            document.querySelectorAll('video:not([src])').forEach( elem => {
                const dataSrc = elem.getAttribute('data-src');
                elem.setAttribute('src',dataSrc);
            } )
        }
    }

    const cleanLogo = () => {
        gsap.killTweensOf(header_logo_normal)
        gsap.killTweensOf(header_logo_group)
        header_logo.classList.remove('small')
        header_logo_normal.classList.remove('d-none')
        header_logo_normal.classList.add('disabled')
        gsap.set(header_logo,{ opacity:1, width:'', height:'' })
        gsap.set(header_logo_normal,{ y:'', opacity:1, top:''})
        gsap.set(header_logo_group,{ y:'', opacity:1})
    }

    //form contacto --> change pos & size label
    if(document.querySelector('.modal--contact')){
        const contacto = document.querySelector('.modal--contact');
        const contacto_wrapInput = contacto.querySelectorAll('.modal__content__form__wrap-input');
        contacto_wrapInput.forEach( elem => {
            const label = elem.querySelector('.modal__content__form__label');
            const input = elem.querySelector('.modal__content__form__input');
            input.addEventListener("focus", () => {
                label.classList.add('on')
            });
            input.addEventListener("focusout", () => {
                if(!input.value) label.classList.remove('on') 
            });
        })
    }

    //change text button anchors depends scroll
    changeButtonAnchors = (valueInit) => {
            
        const btn_anchors = document.querySelector('.header__footer__btn > span');
        const btn_anchors_span_number = document.querySelector('.header__footer__btn span.number');
        const btn_anchors_span_name = document.querySelector('.header__footer__btn span.name');
        
        chaptersAll.forEach( elem => {

            const numberChapter = elem.querySelector('.mod-title__intro > div:nth-of-type(3)').innerHTML;
            const nameChapter = elem.querySelector('.mod-title__intro > div:nth-of-type(2)').innerHTML;
            const indexElem = Array.from(chaptersAll).indexOf(elem);
            
            ///
            const changeText_tl = gsap.timeline({paused:true});
            changeText_tl.fromTo(btn_anchors,{y: '0%'},{y: '-200%', duration:.25, ease:"power3.in",
                onComplete:()=>{
                    btn_anchors_span_number.innerHTML = '0'+numberChapter[1];
                    btn_anchors_span_name.innerHTML = nameChapter;
                    if(!valueInit) setRolloverBtnBg(btn_anchors,false);
                    // if(control) console.log('change anchor',numberChapter[1]+' - '+nameChapter );
                }
            });
            changeText_tl.fromTo(btn_anchors,{y: '200%'},{y: '0%', duration:.25, ease:"power3.out",
                onReverseComplete:()=>{
                    if(chaptersAll[indexElem-1]){
                        const numberChapter = chaptersAll[indexElem-1].querySelector('.mod-title__intro > div:nth-of-type(3)').innerHTML;
                        const nameChapter = chaptersAll[indexElem-1].querySelector('.mod-title__intro > div:nth-of-type(2)').innerHTML;
                        btn_anchors_span_number.innerHTML = '0'+numberChapter[1];
                        btn_anchors_span_name.innerHTML = nameChapter;
                        if(!valueInit) setRolloverBtnBg(btn_anchors,false);
                    }
                }
            })

            //set first chapter
            setTimeout(() => { if(!indexElem && valueInit) changeText_tl.play(); }, 250);

            const tooggleActs = (!indexElem) ? 'play none none none' : 'play none none reverse'

            const triggerAnchors = ScrollTrigger.create({
                animation: changeText_tl,
                trigger: elem,
                start: "top 85%",
                toggleActions: tooggleActs,
                // markers: true,
            })

            if(valueInit){
                setTimeout(() => { triggerAnchors.refresh() }, 3000);
                setTimeout(() => { triggerAnchors.refresh() }, 6000);
            }
            

        })

    }

    ///ON_RESIZE
    ///ON_RESIZE
    ///ON_RESIZE
    let lastWindowWidth; 
    const onResize = () => {
       
        // if(control) console.log('resize');
        is_lg = (window.innerWidth<=1024);
        is_mobile = (window.innerWidth<=950);
        // if(control) console.log('is_lg: ',is_lg);

        //reInit when change desktop to mobile or inverse
        if( lastWindowWidth<=768 && window.innerWidth>768 || lastWindowWidth>=768 && window.innerWidth<768 ){

            //reLoad
             window.location.reload()

        }else{

            //setResize
            // processResize = true;

            //ScrollTrigger.refresh
            ScrollTrigger.refresh();

            //setFollow
            setFollow()

            //setAspectRatio media
            setAspectRatio()

            ///changeButtonAnchors
            changeButtonAnchors(false);
        }  


        //lastWindowWidth
        lastWindowWidth = window.innerWidth;
        
    }
    window.addEventListener('resize',onResize)

    ///ON_SCROLL
    ///ON_SCROLL
    ///ON_SCROLL
    // const onScroll = () => {
       
    //     if(control) console.log('scroll');
        
    //     ///set window height
    //     // htmlEl.style = '--vh:'+window.innerHeight;
        
    // }
    // window.addEventListener('scroll',onScroll)
    
 
    ///INIT
    ///INIT
    ///INIT
    init = () => {

        if(control) console.log('----- init ------');

        // ScrollTrigger.clearScrollMemory("manual"); 

        ///clear main y transition
        gsap.set(main,{opacity:1})

        ///set window height
        htmlEl.style = '--vh:'+window.innerHeight;

         //only once time
        if(!onlyOnce){
            //setSmooth
            setSmooth();
            //setFollow
            if(!is_mobile) setFollow();
        } 

        //scroll top
        if(!is_mobile){  
            if(lenis && lenisStop)         
                window.scrollTo(0, 0)
        }else{
            smoothWrapper.scrollTo({top: 0,left: 0,behavior: 'instant'});
        }

        //lenis stop
        if(lenis && lenisStop) lenis.stop()

        //setAspectRatio media
        setAspectRatio();

        //set scroll horizontal
        if(document.querySelector('.mod-scroll')) setScrollH();

        //show menu
        // if(document.querySelector('.mod-header--proyecto')){
        //     document.querySelector('.btn--menu').classList.add('disabled')
        // }else{
        //     document.querySelector('.btn--menu').classList.remove('disabled')
        // }

        //show link disponibilidad
        if(document.querySelector('.mod-header--proyecto')){
            document.querySelector('#menu-principal .no-show-scroll').classList.remove('disabled')
        }else{
            document.querySelector('#menu-principal .no-show-scroll').classList.add('disabled')
        }

        //reinit mouseChanges
        if(!is_mobile){mouseChanges()} 

        //init_animations
        init_animations()     

        //si hay cookies
        if(document.querySelector('.cky-consent-container')){
            const banner_cookie = document.querySelector(".cky-consent-container");
            banner_cookie.classList.add('on')
            gsap.from(banner_cookie,{opacity:0, duration:.5, delay: 1, ease:'power1.inOut'})
        }

    }

    ///REST
    ///REST
    ///REST
    restInit = () => {

        if(control) console.log('----- restInit ------');

        //setSliders
        setSliders();

        //setRollovers
        setRollovers();

        //setClicks
        setClicks();

        //last_animations
        if(!document.querySelector('.mod-scroll') || is_mobile) last_animations()

        //generateVideos
        generateVideos()

        //ScrollTrigger.refresh
        ScrollTrigger.refresh();

        //lenis start
        if(lenis && lenisStop) lenis.start()
        
        //onlyOnce
        onlyOnce = true;

    }

    ///INIT SWUP
    ///INIT SWUP
    ///INIT SWUP
    initSwup = () => {

        //console.log('----- init swup ------');
    
        swup = new Swup({
            containers: ['#smooth-wrapper','#wrap-modals'],
            linkSelector: 'a[href]:not([href="contacto"]):not([href="disponibilidad"]):not([target="_blank"])',
            animateHistoryBrowsing: true,
            cache: false
        });

        swup.hooks.replace('animation:out:await', async () => {
            if(control) console.log('animation:out'); 

            if(document.querySelector('.modal--alert')) alert_tl.timeScale(2).reverse()

            const anima_out = gsap.timeline({paused:true})

            //anima header,transition & smoothWrapper
            anima_out.fromTo(header, {y:'0%'},{y:'-100vh', duration: 1, ease: 'power3.inOut'});  
            anima_out.fromTo(menu, {y:'0%'},{y:'-100vh', duration: 1, ease: 'power3.inOut'},'<');  

            if(document.querySelector('.mod-scroll') && onScroll){
                anima_out.fromTo(document.querySelector('.mod-scroll'), {y:'0%'},{y:'-100vh', duration: 1, ease: 'power3.inOut'},'<')
            }else{
                anima_out.fromTo(smoothWrapper, {y:'0%'},{y:'-100vh', duration: 1, ease: 'power3.inOut'},'<')
            }

            //anima transition
            anima_out.fromTo(transition, {y:'100vh'},{y:'0%', duration: 1, ease: 'power3.inOut',
                onComplete: () => {
                    if(control) console.log('-- init transition out');
                    
                    cleanLogo();
                    gsap.set(header_logo,{opacity:0})
                    header_btn_tl.progress(0).reverse()
                    header_anchors_tl.progress(0).reverse()

                    ///fix positions
                    gsap.set(transition,{ zIndex:5 })
                    gsap.set(header, {y:'0%'}); 
                    gsap.set(menu, {y:'0%'});
                    gsap.set(smoothWrapper, {y:'0%'});

                    //close menu
                    menu_tl.progress(.000001).reverse()
                    openMenu = false;

                    if(control) console.log('-- complete transition out');
                },
            },'<');

            ///anima logo in
            anima_out.to(transition,{opacity:1, duration: 2.65, ease: 'power3.inOut',onStart:()=>{
                gsap.from(header.querySelectorAll('.logo__normal span,.logo__is span,.logo__boring span'),
                    {x:'120%', duration: .33, stagger: 0.075, ease: 'power3.out', 
                        onStart: () => {
                            gsap.set(header_logo,{opacity:1})
                        },
                        onComplete: () => {
                            if(control) console.log('complete anima logo in');
                        }
                })
            }})
            

            await anima_out.play();

        });
        swup.hooks.replace('animation:in:await', async () => {

            if(control) console.log('animation:in');

            await setTimeout(() => {

                ///reinit vars
                window.scrollTo(0, 0)
                smoothWrapper = document.querySelector("#smooth-wrapper");
                smoothContent = document.querySelector("#smooth-content");
                main = document.querySelector('main');
                chaptersAll = document.querySelectorAll('.mod-title--chapter.count');
                terms = (document.querySelector('.mod-scroll__terms')) ? document.querySelector('.mod-scroll__terms') : undefined;

                // ScrollTrigger.refresh();

                //control color smoothWrapper
                if(document.querySelector('.mod-scroll__intro.bg-black') || document.querySelector('.mod-header--proyecto')){
                    smoothWrapper.classList.add('bg-black')
                }

                //set init screen to start
                gsap.killTweensOf(transition)
                gsap.to(transition,{opacity:0, duration: .5, ease: 'linear',
                    onComplete: ()=>{
                        gsap.set(transition,{opacity:1, y:'100%', zIndex:''});
                        //INIT
                        setTimeout(init, 50);
                    }
                });

                
            }, 100);

        });

    }

    initSwup();
        
    
})
