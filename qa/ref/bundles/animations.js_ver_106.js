document.addEventListener('DOMContentLoaded', () => {


    ///INIT ANIMATIONS
    init_animations = () => {

        if(control) console.log('--- init_animations ');

        ///anima header__logo to intro small logo
        if(document.querySelector('.header__logo') && !header_logo_tl ){
            
            header_logo_tl = gsap.timeline({paused:true, 
                onStart: ()=>{
                    header_logo.classList.add('small')
                    gsap.killTweensOf(header_logo_normal)
                    gsap.killTweensOf(header_logo_group)
                    gsap.killTweensOf(header.querySelectorAll('.logo__normal span,.logo__is span,.logo__boring span'))

                    gsap.set(header.querySelectorAll('.logo__normal span,.logo__is span,.logo__boring span'),{y:'0%'})
                    gsap.set(header_logo,{ width:'100%', height:'100%' })
                    gsap.set(header_logo_normal,{ y:'-180%', top:posLogoMobile, opacity:0 })
                    gsap.set(header_logo_group,{ y:'130%', opacity:0 })
                    
                    header_logo_normal.classList.remove('disabled')
                    header_logo_normal.classList.remove('d-none')
                    // gsap.set(header_logo,{ opacity:1 })
                },
                onReverseComplete: ()=>{
                    header_logo.classList.remove('small')
                    gsap.killTweensOf(header_logo_normal)
                    gsap.killTweensOf(header_logo_group)
                    gsap.set('.header__logo',{ opacity:0, width:'', height:'' })
                    gsap.set(header_logo_normal,{ top:'' })
                    header_logo_normal.classList.add('disabled')
                    gsap.set(header_logo_normal,{ opacity:0 })
                    gsap.set(header_logo_group,{ opacity:0 })
                }
            })

            header_logo_tl.to('.header__logo',{ opacity:1, duration: 1, 
                onStart: ()=>{
                    if(control) console.log('start header_logo_tl');
                    gsap.set(header_logo_normal,{ opacity:1 })
                    gsap.set(header_logo_group,{ opacity:1 })
                    gsap.fromTo(header_logo_normal,{ y:'-180%'},{ y:'0%',  duration: .75, ease: 'power3.out' })
                    gsap.fromTo(header_logo_group,{ y:'130%'},{ y:'0%', duration: .75, ease: 'power3.out' },'<')
                }
            })
            header_logo_tl.to('.header__logo',{ opacity:1, duration: .00001, 
                onReverseComplete: ()=>{
                    if(control) console.log('reverseComplete header_logo_tl');
                    gsap.fromTo(header_logo_normal,{ y:'0%'},{ y:'-180%',  duration: .25, ease: 'power2.in' })
                    gsap.fromTo(header_logo_group,{ y:'0%'},{ y:'130%', duration: .25, ease: 'power2.in' },'<')
                } 
            })
            
        }
        
        ///anima header__btn init (btn menu)
        if(document.querySelector('.header__btn') && !header_btn_tl){

            const header_btn = document.querySelector('.header__btn');
            const header_btn_height = header_btn.offsetHeight;

            header_btn_tl = gsap.timeline({paused:true, 
                onStart: ()=>{ header_btn.classList.remove('d-none') },
                onComplete: ()=>{
                    setRolloverBtnBg(header_btn,true)
                }
            })
            header_btn_tl.from(header_btn,{ y:'-180%', duration: .5, ease: 'power3.out' })
            header_btn_tl.from(header_btn,{ width: header_btn_height, duration: .5, ease: 'power2.inOut'},'-=.25')
            header_btn_tl.from(header_btn.querySelector('span'),{ opacity: 0, duration: .35, ease: 'linear'},'-=.25')

        }

        ///anima header__footer__btn init (btn anchors)
        if(document.querySelector('.header__footer__btn') && !header_anchors_tl){
            // if(control) console.log('--- init anim anchors ');
            const header_anchors = document.querySelector('.header__footer__btn');
            const header_anchors_height = header_anchors.offsetHeight;
            header_anchors_tl = gsap.timeline({paused:true, onComplete: ()=>{
                setRolloverBtnBg(header_anchors,true)
                changeButtonAnchors(false)
            } })
            header_anchors_tl.from(header_anchors,{ y:'230%', duration: .5, ease: 'power3.out' },1)
            header_anchors_tl.from(header_anchors,{ width: header_anchors_height*.1, duration: .5, ease: 'power2.inOut', 
                onComplete:()=>{ gsap.set(header_anchors,{width:''}) }},'-=.25')
            header_anchors_tl.from(header_anchors.querySelector(':scope > span'),{ opacity: 0, duration: .5, ease: 'linear'},'-=.25')
        }

        //anima cabecera scroll
        if(document.querySelector('.mod-scroll__intro')){
            scroll_intro_tl.progress(0).timeScale(timescale).play()       
        }

        //anima cabecera proyecto
        else if(document.querySelectorAll('.mod-header--proyecto').length > 0){

            //show anchors if isset chapters
            btnAnchors.classList.add('d-none')
            chaptersAll = document.querySelectorAll('.mod-title--chapter.count');
            if(chaptersAll.length){
                changeButtonAnchors(true)
                btnAnchors.classList.remove('d-none')
            }

            document.querySelectorAll('.mod-header--proyecto').forEach( (elem) => {
                const logo_wrap = elem.querySelector('.mod-header__content__wrap-title-text')
                const logo_images = elem.querySelectorAll('.mod-header__content__title-text')
                const image = elem.querySelector('.mod-header__content__title-image')
                const pretitle = elem.querySelector('.mod-header__content__pretitle')
                const caption = elem.querySelector('.mod-header__content__caption')
                const footer_text = elem.querySelector('.mod-header__footer__text')
                const modalAlert = document.querySelector('.modal--alert__content')
                //
                const cabecera_tl = gsap.timeline({paused:true, 
                    onStart: () => {
                        logo_wrap.classList.add('d-none')
                        // pretitle.classList.add('d-none')
                        // caption.classList.add('d-none')
                        if(control) console.log('--start proyecto cabecera_tl');

                    },
                    onComplete: () => {
                        gsap.to(image,{width:'',height:''})
                        setTimeout(() => { restInit();}, 350);
                        setTimeout(() => {if(modalAlert) alert_tl.play()  }, 750);
                    }
                })
                //change color init
                
                const cabecera_bgcolor = getStyle(elem.querySelector('.mod-header__content'))['background-color'];
                cabecera_tl.fromTo(elem.querySelector('.mod-header__content'),{backgroundColor: 'var(--black)'},
                    {backgroundColor: cabecera_bgcolor, duration:.5, ease:'none'})

                //anim out logo
                cabecera_tl.to(header.querySelectorAll('.logo__normal span'),
                    {y:'120%', duration: .35, stagger: 0.125, ease: 'power3.in'})
                cabecera_tl.to(header.querySelectorAll('.logo__boring span'),
                    {y:'120%', duration: .35, stagger: -0.125, ease: 'power3.in'},'<+=.120')
                cabecera_tl.to(header.querySelectorAll('.logo__is span'),
                    {y:'120%', duration: .35, stagger: 0.125, ease: 'power3.in'},'<+=.65')

                // //anim images
                cabecera_tl.from(image,{ '--clipPath':'100% 0% 0% 0%', duration: 2, ease: 'power3.inOut', onComplete: ()=>{
                    gsap.set(elem,{backgroundColor: ''})
                }},.7)
                cabecera_tl.from(image.querySelector('.image'),{ y:'33%', duration: 2, ease: 'power3.inOut'},'<')

                //anim image
                cabecera_tl.from(image,{ height: '105vh', duration: 1.25, ease: 'power3.inOut'} )
                cabecera_tl.from(image.querySelector('.media__source'),{ scale: 1.4, duration: 3, ease: 'power2.out(.5)'},'<')
                cabecera_tl.from(image,{ width: '100vw', duration: 1.25, ease: 'power3.inOut'},'<+=.15')
                

                //anim logo
                cabecera_tl.from(logo_images[0],{ y:'110%', duration: 1, ease: 'power2.out',
                    onStart: () => {
                        logo_wrap.classList.remove('d-none')
                        // pretitle.classList.remove('d-none')
                        // caption.classList.remove('d-none')
                    }
                },'-=1')
                if(logo_images[1])
                    cabecera_tl.from(logo_images[1],{ y:'110%', duration: 1.25, ease: 'power2.out' },'-=.5')
                
                //anim rest
                cabecera_tl.from(logo_images,{opacity:1, duration: 1, onStart:()=>{
                    if(control) console.log('header_logo_tl.play()');
                    header_logo_tl.progress(0).play()
                }},'-=.5')
                cabecera_tl.from(logo_images,{opacity:1, duration: 1, 
                    onStart:()=>{
                        header_btn_tl.play()
                        header_anchors_tl.play()
                    }
                },'-=.5')
                cabecera_tl.from(pretitle,{ y:'105%', opacity:0, duration: 1, ease: 'power3.out' },'-=.5')
                cabecera_tl.from(caption,{ y:'-105%', opacity:0, duration: 1, ease: 'power3.out' },'-=1')
                cabecera_tl.from(footer_text,{ opacity:0, duration: 1, ease: 'power3.out' },'-=.5')

                /////
                cabecera_tl.progress(0).timeScale(timescale).play();


                ///set anima-out header with scrolltrigger
                cabecera_out_tl = gsap.timeline({paused:true})
                cabecera_out_tl.to(elem,{opacity:.85})
                cabecera_out_tl.to(elem.querySelectorAll('.mod-header__content'),{scale:.85},'<')

                 ScrollTrigger.create({
                    animation: cabecera_out_tl,
                    trigger: elem,
                    start: "100% 100%",
                    end: '+=100%',
                    scrub: .5,
                    // toggleActions: 'play none none reverse',
                    // markers: true,
                })

            })


            //anima modal--alert
            if(document.querySelectorAll('.modal--alert').length){

                const alert = document.querySelector('.modal--alert');
                const alert_content = document.querySelector('.modal--alert__content');
                const alert_bg = document.querySelector('.modal--alert__bg');
                const btn_alert = document.querySelector('.modal--alert__btn');
                const close_alert = document.querySelector('.modal--alert__close');
                const dur = (is_mobile) ? .33 : 1 ;

                alert_tl = gsap.timeline({paused:true, 
                    onStart: () => { alert.classList.remove('d-none') },
                    onReverseComplete: () => { alert.classList.add('d-none') }});
                alert_tl.from(alert,{x:'-108%', duration: .75, ease: 'power3.out'},0)
                alert_tl.fromTo(alert_bg,{width: (alert_content.offsetWidth/4)+'px'},{width:'100%' ,duration: dur, ease: 'power3.out'},0)
                alert_tl.from(close_alert,{scaleX:'0',scaleY:'0', rotate: '180deg', duration: .5, ease: 'back.out'})

                //close
                close_alert.addEventListener('click',() => {
                    if(control) console.log('close_alert');
                    alert_tl.reverse()
                })
                //btn click
                btn_alert.addEventListener('click',() => {
                    if(control) console.log('btn_alert');
                    alert_tl.reverse()
                })


            }
                    
        }

        //anima cabecera no proyecto
        else if(document.querySelectorAll('.mod-header:not(.mod-header--proyecto)').length > 0){

            document.querySelectorAll('.mod-header:not(.mod-header--proyecto)').forEach( elem => {

                const cabecera_images = elem.querySelectorAll('.flipMedia')
                const footer_text = elem.querySelector('.mod-header__footer__text')
                
                const cabecera_tl = gsap.timeline({paused:true, 
                    onStart: () => { if(control) console.log('--start NOproyecto cabecera_tl'); },
                    onComplete: () => { restInit(); }
                })

                //anim out logo
                cabecera_tl.to(header.querySelectorAll('.logo__normal span'),
                    {y:'120%', duration: .35, stagger: 0.125, ease: 'power3.in'})
                cabecera_tl.to(header.querySelectorAll('.logo__boring span'),
                    {y:'120%', duration: .35, stagger: -0.125, ease: 'power3.in'},'<+=.120')
                cabecera_tl.to(header.querySelectorAll('.logo__is span'),
                    {y:'120%', duration: .35, stagger: 0.125, ease: 'power3.in'},'<+=.65')
                
                //anim text
                elem.querySelectorAll('.mod-header__content__wrap-lines .line').forEach( (el,ind) => {
                    const split = SplitText.create(el, {type: "chars", charsClass:'char'})
                    const posInit = (ind%2!=0) ? '-110%' : '110%';
                    cabecera_tl.from(el.querySelectorAll('.char'),{y:posInit, duration: .65, stagger: 0.035, ease: 'power3.out'},"<+=.1")
                })

                ///anim logo y btn menu
                cabecera_tl.from(footer_text,{ opacity:0, duration: .5, ease: 'power3.out',
                    onStart:()=>{
                        header_logo_tl.progress(0).play()
                    },
                    onComplete:()=>{
                        header_btn_tl.play()
                    }
                },1.5)

                //anim images
                cabecera_images.forEach( (elem,index) => {
                    const clipPath = (index%2==0) ? '100% 0% 0% 0%' : '0% 0% 100% 0%';
                    const posY = (index%2==0) ? '35%' : '-35%';
                    cabecera_tl.from( elem,{'--clipPath':clipPath, duration: .95, ease: 'power3.out'},1.5+(index*.25))
                    cabecera_tl.from( elem.querySelectorAll('.media'),{y:posY, duration: 1.33, ease: 'power3.out'},'<')
                })

                
                

                 /////
                cabecera_tl.progress(0).timeScale(timescale).play();

            } )
                    
        }

        //anima pag legal
        else{

            if(control) console.log('anim pag legal');
            
            const cabecera_tl = gsap.timeline({paused:true, 
                onStart: () => { if(control) console.log('--start LEGAL cabecera_tl'); },
                onComplete: () => { restInit(); }
            })

            //anim out logo
            cabecera_tl.to(header.querySelectorAll('.logo__normal span'),
                {y:'120%', duration: .35, stagger: 0.125, ease: 'power3.in'})
            cabecera_tl.to(header.querySelectorAll('.logo__boring span'),
                {y:'120%', duration: .35, stagger: -0.125, ease: 'power3.in'},'<+=.120')
            cabecera_tl.to(header.querySelectorAll('.logo__is span'),
                {y:'120%', duration: .35, stagger: 0.125, ease: 'power3.in'},'<+=.65')
            

            ///anim logo y btn menu
            cabecera_tl.from(document.querySelector('main'),{ opacity:0, duration: 1.5, ease: 'linear',
                onStart:()=>{
                    header_logo_tl.progress(0).play()
                },
                onComplete:()=>{
                    header_btn_tl.play()
                }
            })

            cabecera_tl.progress(0).timeScale(timescale).play();

        }

    }

    ///LAST ANIMATIONS
    last_animations = () => {

        if(control) console.log('--- last_animations ');

        //anima title
        if(document.querySelectorAll('.mod-title').length > 0){

            document.querySelectorAll('.mod-title').forEach( (elem) => {

                if(!elem.classList.contains('anim_created')){

                    //anim line by line
                    if(elem.classList.contains('anim-line')){

                        const title_tl = gsap.timeline({paused:true})

                        if(elem.querySelector('.anima__title')){
                            const splitLine = SplitText.create(elem.querySelector('.anima__title'), {type: "lines", linesClass:'line clip-y'})
                            elem.querySelector('.anima__title').querySelectorAll('.line').forEach( (elem,ind) => {
                                const split = SplitText.create(elem, {type: "chars", charsClass:'char'})
                                const posInit = (ind%2!=0) ? '-110%' : '110%';
                                title_tl.from(elem.querySelectorAll('.char'),{y:posInit, duration: .75, stagger: 0.05, ease: 'power3.out'},"-=.4")
                                // title_tl.to(elem,{paddingTop:'0.2em', paddingBottom:'0.2em' , marginTop:'-0.15', marginBottom:'-0.3em', duration: 1, stagger: 0.04, ease: 'power3.out'},"<")
                            })
                        }else{
                            elem.querySelectorAll('.line').forEach( (elem,ind) => {
                                const split = SplitText.create(elem, {type: "chars", charsClass:'char'})
                                const posInit = (ind%2!=0) ? '-110%' : '110%';
                                title_tl.from(elem.querySelectorAll('.char'),{y:posInit, duration: .65, stagger: 0.04, ease: 'power3.out'},"-=.4")
                                // title_tl.fromTo(elem,{paddingTop:'0', marginTop:'0'},{paddingTop:'.2em', marginTop:'-.2em', duration: .65, stagger: 0.04, ease: 'power3.inOut'},"-=.2")
                                
                            })
                        }
                        
                        ScrollTrigger.create({
                            animation: title_tl,
                            trigger: elem.querySelector('.anima__title'),
                            start: "top 80%",
                            // toggleActions: 'play none none reverse',
                            // markers: true,
                        })

                        elem.classList.add('anim_created')
                    }

                    //anim spaces
                    if(elem.classList.contains('anim-space')){
                        const animLines = elem.querySelectorAll('.anim-line')
                        animLines.forEach(elem => {
                            const content = elem.innerHTML;
                            elem.innerHTML = '<span>'+content+'</span>';
                        })

                        const title_tl = gsap.timeline({paused:true})
                        animLines.forEach( (elem,index) => {
                            title_tl.to(elem.querySelector('span'),{left:elem.offsetWidth, x:'-100%', duration: 1.25, ease: 'power2.out'},index*.5)
                        })

                        ScrollTrigger.create({
                            animation: title_tl,
                            trigger: elem,
                            start: "top 75%",
                            end: "bottom 10%",
                            onRefresh: () => {
                                if(control) console.log('Refresh scrolltrigger anim-space')
                                animLines.forEach( (elem,index) => {
                                    title_tl.to(elem.querySelector('span'),{left:elem.offsetWidth, x:'-100%', duration: 1.25, ease: 'power2.out'},index*.5)
                                })
                            }
                            // toggleActions: 'play none none reverse',
                            // markers: true,
                        })

                        elem.classList.add('anim_created')
                    }

                }
                    
            })
                    
        }

        //anima paragraph
        if(document.querySelectorAll('.mod-content.anim-line, .mod-content.anim-line-op').length > 0){

            //anim by lines
            document.querySelectorAll('.mod-content.anim-line .mod-content__text > p').forEach( (elem) => {

                const split = SplitText.create(elem, {type: "lines"})
                split.lines.forEach(elem => {
                    const content = elem.innerHTML;
                    elem.innerHTML = '<span>'+content+'</span>';
                })
                const paragraph_tl = gsap.timeline({paused:true})
                paragraph_tl.from(elem.querySelectorAll('span'),{y:'100%', duration: .5, stagger: 0.09, ease: 'power3.easeOut'})

                ScrollTrigger.create({
                    animation: paragraph_tl,
                    trigger: elem,
                    start: "top 75%",
                    end: "bottom 10%",
                    // toggleActions: 'play none none reverse',
                    // markers: true,
                })
                    
            })

            //anim by lines with opacity
            document.querySelectorAll('.mod-content.anim-line-op .mod-content__text > p').forEach( (elem) => {

                const split = SplitText.create(elem, {type: "lines, chars",})
                const paragraph_tl = gsap.timeline({paused:true})
                paragraph_tl.fromTo(split.chars,{opacity:.3},{opacity:1, duration: .5, stagger: 0.005, ease: 'power3.easeOut'})

                ScrollTrigger.create({
                    animation: paragraph_tl,
                    trigger: elem,
                    start: "top 90%",
                    end: "50% 40%",
                    scrub: .5,
                    // toggleActions: 'play none none reverse',
                    // markers: true,
                })
                    
            })

                    
        }
        
        //anima media
        if(document.querySelectorAll('.media:not(.no-general-anim)').length > 0){
                
            document.querySelectorAll('.media:not(.no-general-anim)').forEach( (elem,index) => {

                //solo si no pertenece a un media section y tiene index 1
                if(!elem.closest('.media-section') || elem.closest('.media-section') && getInd(elem.closest('.media-section'))!=1){
                    
                    const wrap_section = elem.closest('section');
                    const animate = (wrap_section!==null && getInd(wrap_section)==1
                        || elem.classList.contains('noAnimate')) ? false : true ;
                    const delay_image = (elem.getAttribute('data-delay')) ? elem.getAttribute('data-delay') : 0 ;

                    //parallax media
                    const media_parallax_tl = gsap.timeline({paused:true})
                        media_parallax_tl.fromTo(elem,{'--transY':'100%'},{'--transY':'0%'}, 0)

                    ScrollTrigger.create({
                        animation: media_parallax_tl,
                        trigger: elem.querySelector('.media__wrap-source'),
                        start: "top 95%",
                        end: "bottom 10%",
                        scrub: .5,
                        // toggleActions: 'play none none reverse',
                        // markers: true,
                    })

                    if( animate ){
                        
                        const media_show_tl = gsap.timeline({paused:true, delay: delay_image});
                        media_show_tl.from( elem,{'--clipPath':'100% 0% 0% 0%', duration: 1.2, ease: 'power3.out'},0)
                        //    media_show_tl.from( elem,{'--scale':'1.1', duration: 1.5, ease: 'power2.inOut'},0)
                        media_show_tl.fromTo( elem.querySelector('.media__wrap-source'),{y:'35%'},{y:'0%', duration: 1.5, ease: 'power3.out'},0)

                        ScrollTrigger.create({
                            animation: media_show_tl,
                            trigger: elem,
                            start: "50% 100%",
                            // toggleActions: 'play none none reverse',
                            // markers: true,
                        })

                    }

                }
                

            })
            
        }

        //pinned
        if(document.querySelectorAll('.pinned').length > 0 && !is_mobile){

            const mainElements = document.querySelectorAll('main > section');
                
            document.querySelectorAll('.pinned').forEach( (elem,index) => {

                const indexElem = getInd(elem);
                
                const prevElemnt = (mainElements[indexElem-1]);
                const prevPrevElemnt = (mainElements[indexElem-2]);
                let startTl = "50% 50%";

                // console.log('prevElemnt.offsetHeight',prevElemnt.offsetHeight);
                // console.log('window.innerHeight',window.innerHeight);
                
                if(prevElemnt && prevElemnt.offsetHeight > window.innerHeight + 10) startTl = "100% 100%";

                ScrollTrigger.create({
                    trigger: prevElemnt,
                    endTrigger: elem,
                    start: startTl,
                    end: '97% bottom',
                    pin: prevElemnt,
                    pinSpacing: false,
                    // markers: true,
                });

                if(prevPrevElemnt && startTl == "50% 50%"){
                    ScrollTrigger.create({
                        trigger: prevElemnt,
                        endTrigger: elem,
                        start: startTl,
                        end: '97% bottom',
                        pin: prevPrevElemnt,
                        pinSpacing: false,
                        // markers: true,
                    });
                }
                

            })
            
        }

        //anima next
        if(document.querySelectorAll('.mod-next').length > 0){
                
            setTimeout(() => {
                document.querySelectorAll('.mod-next__main').forEach( (elem,index) => {

                    const nextLink = elem.closest('.mod-next').querySelector('.next__header__link--next');
                    const image = document.querySelector('.mod-next__main__image')
                    const duration_total = 3;
                    const width_total = elem.getBoundingClientRect().width; 
                    const left = image.getBoundingClientRect().left;
                    const right = image.getBoundingClientRect().width;
                    let delay_mask = (left*duration_total)/(width_total*1.04);
                    let duration_mask = (right*duration_total)/(width_total*1.058);

                    if(is_mobile){
                        const height_total = elem.offsetHeight; 
                        const bottom = elem.offsetHeight - image.offsetTop - image.offsetHeight;//image.getBoundingClientRect().top;
                        const height_image = image.getBoundingClientRect().height
                        delay_mask = (bottom*duration_total)/(height_total*.99);
                        duration_mask = (height_image*duration_total)/(height_total*1);
                    }
                    
                    const next_tl = gsap.timeline({paused:true})
                    if(!is_mobile){
                        next_tl.fromTo(elem.querySelector('.mod-next__main__load'),
                            {width:'0%'},{width:'110%', duration:duration_total, ease:'none', onComplete: () => {
                                if(control) console.log('next lg');
                                if(document.querySelector('.next__header__link--next'))
                                    nextLink.click();
                            } } 
                        ) 
                        next_tl.to( '.mod-next__main__image__source:nth-of-type(1)',{'x':'33%', delay: delay_mask, duration: duration_mask, ease: 'power1.inOut'},0)
                        next_tl.from( '.mod-next__main__image__source:nth-of-type(2)',{'--clipPath':'0% 100% 0% 0%', delay: delay_mask, duration: duration_mask, ease: 'none'},0)

                    }else{
                        next_tl.fromTo(elem.querySelector('.mod-next__main__load'),
                            {height:'0%'},{height:'100%', duration:duration_total, ease:'none', onComplete: () => {
                                if(control) console.log('next md');
                                if(document.querySelector('.next__header__link--next'))
                                    nextLink.click();
                            } }
                        ) 
                        // next_tl.to( '.mod-next__main__image__source:nth-of-type(1)',{'y':'-35%', duration: duration_mask, ease: 'power1.inOut'},delay_mask)
                        next_tl.from( '.mod-next__main__image__source:nth-of-type(2)',{'--clipPath':'100% 0% 0% 0%', duration: duration_mask, ease: 'none'},delay_mask)
                    }
                    
                    triggerNext = ScrollTrigger.create({
                        trigger: elem,
                        start: "90% bottom",
                        onEnter: () => { next_tl.play() },
                        onLeaveBack: () => { next_tl.reverse() },
                        // markers: true,
                    })
                })
            }, 20);
            
        }

        //anima footer
        if(document.querySelectorAll('.mod-footer').length > 0){

            if(control) console.log('--- mod-footer');
                
            document.querySelectorAll('.mod-footer').forEach( (elem) => {

                ///footer__bg
                const footer_logo_tl = gsap.timeline({paused:true})
                footer_logo_tl.to("#B_inicial_top", { duration: 1, morphSVG: "#B_final_top" },0);
                footer_logo_tl.to("#B_inicial_bottom", { duration: 1, morphSVG: "#B_final_bottom" },0);
                footer_logo_tl.to("#B_inicial_left", { duration: 1, morphSVG: "#B_final_left" },0);
                footer_logo_tl.to("#B_inicial_right", { duration: 1, morphSVG: "#B_final_right" },0);
                footer_logo_tl.to("#O_inicial_top", { duration: 1, morphSVG: "#O_final_top" },0);
                footer_logo_tl.to("#O_inicial_bottom", { duration: 1, morphSVG: "#O_final_bottom" },0);
                footer_logo_tl.to("#O_inicial_left", { duration: 1, morphSVG: "#O_final_left" },0);
                footer_logo_tl.to("#O_inicial_right", { duration: 1, morphSVG: "#O_final_right" },0);
                footer_logo_tl.to("#R_inicial", { duration: 1, morphSVG: "#R_final" },0);
                
                ScrollTrigger.create({
                    animation: footer_logo_tl,
                    trigger: elem.querySelector('.mod-footer__bg'),
                    start: "top 50%",
                    end: 'bottom bottom',
                    scrub: 2,
                    // markers: true,
                });

    
                ///footer__project
                const split_Title = SplitText.create(elem.querySelector('.mod-footer__content__project__name'), {type: "chars"})
                const split_Text = SplitText.create(elem.querySelector('.mod-footer__content__project__text'), {type: "lines"})
                split_Text.lines.forEach(el => {
                    const content = el.innerHTML;
                    el.innerHTML = '<span>'+content+'</span>';
                })
                const footer_project_tl = gsap.timeline({paused:true})
                footer_project_tl.from(elem.querySelector('.mod-footer__content__project__year'),
                    {y:'100%', opacity:'0', duration: .55, ease: 'power3.out'},0)
                footer_project_tl.from(split_Title.chars,{y:'-100%', duration: .65, stagger: 0.025, ease: 'power3.out'},.33)
                footer_project_tl.from(elem.querySelectorAll('.mod-footer__content__project__text span'),
                    {y:'-100%', duration: .5, stagger: 0.15, ease: 'power3.out'},.66)

                ScrollTrigger.create({
                    animation: footer_project_tl,
                    trigger: elem.querySelector('.mod-footer__content__project__wrap-image'),
                    start: "bottom 75%",
                    // end: 'top 50%',
                    // toggleActions: 'play none none reverse',
                    // markers: true,
                });

            })
            
        }

        //setFlips only if no have mod-scroll
        if(!document.querySelectorAll('.mod-scroll').length){
            setFlips()
        }
        


    }

});



