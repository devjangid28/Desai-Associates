
document.addEventListener('DOMContentLoaded', () => {

    //setLink
    setLink = (btn) => {

        const time = (!is_mobile) ? .33 : 0 ;

        document.querySelectorAll(btn).forEach( elem => {

            if(!elem.classList.contains('link_created')){
                if(!elem.classList.contains('under')){

                    if(!elem.closest('.header__menu__nav-site')){
                        const splitText = new SplitText(elem,{type: "chars,words,lines", linesClass:'line', charsClass:'char'})
                        const link_content = elem.innerHTML;
                        elem.innerHTML += link_content;

                        gsap.set(elem.querySelectorAll('.line:nth-of-type(2) .char'),{y:'105%'})

                        if(elem.classList.contains('logo__normal')){
                            elem.querySelectorAll('span').forEach( elem => elem.classList.add('w-100'))
                        }

                        elem.addEventListener('mouseenter', () => {
                            if(!elem.classList.contains('disabled')){
                                gsap.to(elem.querySelectorAll('.line:nth-of-type(2) .char'),
                                    {y:'0%', duration: .5, delay: 0, ease: 'power2.inOut', stagger: .025})
                                gsap.to(elem.querySelectorAll('.line:nth-of-type(1) .char'),
                                    {y:'-105%', duration: .5, delay: 0.025, ease: 'power2.inOut', stagger: .025})
                            } 
                        })
                        elem.addEventListener('mouseleave', () => {
                            if(!elem.classList.contains('disabled')){
                                gsap.killTweensOf(elem.querySelectorAll('.char'))
                                gsap.to(elem.querySelectorAll('.line:nth-of-type(1) .char'),
                                    {y:'0%', duration: .5, delay: 0, ease: 'power2.inOut', stagger: .025})
                                gsap.to(elem.querySelectorAll('.line:nth-of-type(2) .char'),
                                    {y:'105%', duration: .5, delay: 0.025, ease: 'power2.inOut', stagger: .025})
                            }
                        })

                    }

                }else{

                    elem.addEventListener('mouseenter', () => {
                        gsap.set(elem,{'--width':'100%', '--x':'0%'})
                        gsap.to(elem,{'--width':'0%', '--x':'100%',  duration:time, ease:'power2.inOut'})
                        gsap.set(elem,{'--width':'0%', '--x':'0%', delay: time})
                        gsap.to(elem,{'--width':'100%', '--x':'0%', duration:time, ease:'power2.inOut', delay: time})
                    })
                    elem.addEventListener('mouseleave', () => {
                        gsap.set(elem,{'--width':'100%', '--x':'0%'})
                        gsap.to(elem,{'--width':'0%', '--x':'0%', duration:time, ease:'power2.inOut'})
                        gsap.set(elem,{'--width':'100%', '--x':'100%', delay: time})
                        gsap.to(elem,{'--width':'100%', '--x':'0%',  duration:time, ease:'power2.inOut', delay: time})
                    })

                    elem.classList.add('link_created')

                }
                elem.classList.add('link_created')
            }

        })

        //not under
        // document.querySelectorAll('.link:not(.under)').forEach( elem => {
        //     elem.addEventListener('mouseenter', () => {
        //         gsap.set(elem,{'--width':'0%', '--x':'0%'})
        //         gsap.to(elem,{'--width':'100%', '--x':'0%', duration:time, ease:'power2.inOut'})
        //     })
        //     elem.addEventListener('mouseleave', () => {
        //         gsap.set(elem,{'--width':'100%', '--x':'0%'})
        //         gsap.to(elem,{'--width':'0%', '--x':'100%',  duration:time, ease:'power2.inOut'})
        //     })
        // })

    }

    //setRolloverBtnBg
    setRolloverBtnBg = (elem,setSpan) => {

        if(!elem.classList.contains('rollover_created')){

            if(!is_mobile){

                if(setSpan){
                    //set span
                    let text_btn = elem.innerHTML;
                    if(!elem.classList.contains('btn--header') && !elem.classList.contains('last-item__carousel__item--link')){
                        elem.innerHTML = '<span>'+text_btn+'</span>';
                    } 
                }
            
                //split span
                // const splitSpan = new SplitText(elem,{type: "chars"})

                const dur = (!is_mobile) ? .33 : .00001;
                const dur2 = (!is_mobile) ? .25 : .00001;
                let pos = ['posXin','posXout','posYin','posYout'], spanPos = ['x','xneg','y','yneg'];
                const colorEnd = (elem.classList.contains('btn--bg-inv'))? 'white' : 'black' ;
                
                elem.addEventListener('mouseenter', (event) => {

                    const rect = elem.getBoundingClientRect();
                    const mouseX = event.clientX;
                    const mouseY = event.clientY;
                    const fromLeft = mouseX - rect.left;
                    const fromRight = rect.right - mouseX;
                    const fromTop = mouseY - rect.top;
                    const fromBottom = rect.bottom - mouseY;
                    const minDistance = Math.min(fromLeft, fromRight, fromTop, fromBottom);
                    
                    if (minDistance === fromLeft) {
                        // if(control) console.log('Mouse entered from the left');
                        pos = ['-102%','102%',0,0];
                        spanPos = ['200%','-200%',0,0];
                    } else if (minDistance === fromRight) {
                        // if(control) console.log('Mouse entered from the right');
                        pos = ['102%','-102%',0,0];
                        spanPos = ['-200%','200%',0,0];
                    } else if (minDistance === fromTop) {
                        // if(control) console.log('Mouse entered from the top');
                        pos = [0,0,'-102%','102%'];
                        spanPos = [0,0,'200%','-200%'];
                    } else if (minDistance === fromBottom) {
                        // if(control) console.log('Mouse entered from the bottom');
                        pos = [0,0,'102%','-102%'];
                        spanPos = [0,0,'-200%','200%'];
                    }

                    if(elem.classList.contains('btn--menu')){
                        if(header_btn_tl.progress() == 1){
                            gsap.killTweensOf(elem)
                            gsap.killTweensOf(elem.querySelector(':scope > span'))
                        }
                    }else if(elem.classList.contains('header__footer__btn')){
                        if(header_anchors_tl.progress() == 1){
                            gsap.killTweensOf(elem)
                            gsap.killTweensOf(elem.querySelector(':scope > span'))
                        }
                    }else{
                        gsap.killTweensOf(elem)
                        gsap.killTweensOf(elem.querySelector(':scope > span'))
                    }
                    

                    gsap.fromTo(elem.querySelector(':scope > span'),{x: 0, y: 0},{x: spanPos[0], y: spanPos[2],  duration:dur, ease:"power3.in",onComplete:()=>{
                        gsap.set(elem.querySelector(':scope > span'),{color:colorEnd})
                        if(elem.querySelector('span.circle'))  gsap.set(elem.querySelector('span.circle'),{background: 'black'})
                    }})
                    if(elem.querySelector('.btn__image')){
                        gsap.to(elem.querySelectorAll('.btn__image path'),{fill: '#FFF',  duration:dur, ease:"power3.in"})
                        gsap.to(elem.querySelector('.btn__image'),{scale: 2, x:'-8px', y:'8px',  duration:dur, ease:"power3.in"})
                    }
                    gsap.fromTo(elem,{'--posX':pos[0],'--posY':pos[2]},{'--posX':'0%','--posY':'0%', duration:dur2, delay: .1, ease:"power3.in"})
                    gsap.fromTo(elem.querySelector(':scope > span'),{x: spanPos[1], y: spanPos[3]},{x: 0, y: 0, duration:dur, delay: dur2, ease:"power3.out"})
                })
                elem.addEventListener('mouseleave', () => {

                    const rect = elem.getBoundingClientRect();
                    const mouseX = event.clientX;
                    const mouseY = event.clientY;
                    const fromLeft = mouseX - rect.left;
                    const fromRight = rect.right - mouseX;
                    const fromTop = mouseY - rect.top;
                    const fromBottom = rect.bottom - mouseY;
                    const minDistance = Math.min(fromLeft, fromRight, fromTop, fromBottom);

                    if (minDistance === fromLeft) {
                        // if(control) console.log('Mouse entered from the left');
                        pos = ['102%','-102%',0,0];
                        spanPos = ['-200%','200%',0,0];
                    } else if (minDistance === fromRight) {
                        // if(control) console.log('Mouse entered from the right');
                        
                        pos = ['-102%','102%',0,0];
                        spanPos = ['200%','-200%',0,0];
                    } else if (minDistance === fromTop) {
                        // if(control) console.log('Mouse entered from the top');
                        pos = [0,0,'102%','-102%'];
                        spanPos = [0,0,'-200%','200%'];
                    } else if (minDistance === fromBottom) {
                        // if(control) console.log('Mouse entered from the bottom');
                        pos = [0,0,'-102%','102%'];
                        spanPos = [0,0,'200%','-200%'];
                    }

                    if(elem.classList.contains('btn--menu')){
                        if(header_btn_tl.progress() == 1){
                            gsap.killTweensOf(elem)
                            gsap.killTweensOf(elem.querySelector(':scope > span'))
                        }
                    }else if(elem.classList.contains('header__footer__btn')){
                        if(header_anchors_tl.progress() == 1){
                            gsap.killTweensOf(elem)
                            gsap.killTweensOf(elem.querySelector(':scope > span'))
                        }
                    }else{
                        gsap.killTweensOf(elem)
                        gsap.killTweensOf(elem.querySelector(':scope > span'))
                    }

                    gsap.fromTo(elem.querySelector(':scope > span'),{x: 0, y: 0,color:colorEnd},{x: spanPos[0], y: spanPos[2], duration:dur, ease:"power3.in",onComplete:()=>{
                        gsap.set(elem.querySelector(':scope > span'),{color: ''})
                        if(elem.querySelector('span.circle'))  gsap.set(elem.querySelector('span.circle'),{background: ''})
                    }})
                    if(elem.querySelector('.btn__image')){
                        gsap.to(elem.querySelectorAll('.btn__image path'),{fill: '#000',  duration:dur, ease:"power3.in"})
                        gsap.to(elem.querySelector('.btn__image'),{scale: 1.5, x:0, y:0,  duration:dur, ease:"power3.in"})
                    }
                    gsap.fromTo(elem,{'--posX':'0%','--posY':'0%'},{'--posX':pos[1],'--posY':pos[3], duration:dur2, delay: .1, ease:"power3.in"})
                    gsap.fromTo(elem.querySelector(':scope > span'),{x: spanPos[1], y: spanPos[3]},{x: 0, y: 0, duration:dur, delay: dur2, ease:"power3.out"})
                })

                elem.classList.add('rollover_created')

            }
        }

    }

    //setRolloversMenu
    setRolloversMenu = () => {

        //rollover menu proyectos
        if(document.querySelectorAll('.header__menu__nav-single__proyectos__item a').length && !onlyOnce){

            const time = (!is_mobile) ? .33 : 0 ;

            document.querySelectorAll('.header__menu__nav-single__proyectos__item a').forEach( elem => {

                const splitTextElem = elem.querySelectorAll('span.title,div.place');
                const splitText = SplitText.create(splitTextElem, {type: "chars, words",charsClass: "char"})
                const link_content = elem.innerHTML;
                elem.innerHTML = '<span class="line">'+link_content+'</span>';
                elem.innerHTML += '<span class="line">'+link_content+'</span>';

                elem.querySelectorAll('.char').forEach( elem => {
                    const charContent = elem.innerHTML;
                    elem.innerHTML = '<span>'+charContent+'</span>';
                })

                //init rollover 
                gsap.set(elem.querySelectorAll('.line:nth-of-type(2) .char span'),{y:'115%'})

                elem.addEventListener('mouseenter', () => {
                    if(!elem.classList.contains('disabled')){
                         gsap.to(elem.querySelectorAll('.line:nth-of-type(2) .char span'),
                            {y:'0%', duration: .5, delay: 0, ease: 'power2.inOut', stagger: .025})
                        gsap.to(elem.querySelectorAll('.line:nth-of-type(1) .char span'),
                            {y:'-115%', duration: .5, delay: 0.025, ease: 'power2.inOut', stagger: .025})
                    }
                   
                })
                elem.addEventListener('mouseleave', () => {
                    if(!elem.classList.contains('disabled')){
                        gsap.killTweensOf(elem.querySelectorAll('.char span'))
                        gsap.to(elem.querySelectorAll('.line:nth-of-type(1) .char span'),
                            {y:'0%', duration: .5, delay: 0, ease: 'power2.inOut', stagger: .025})
                        gsap.to(elem.querySelectorAll('.line:nth-of-type(2) .char span'),
                            {y:'115%', duration: .5, delay: 0.025, ease: 'power2.inOut', stagger: .025})
                    }
                })
                
            })

        }

        //rollover menu site
        if(document.querySelectorAll('.header__menu__nav-site a').length && !onlyOnce){

            const time = (!is_mobile) ? .33 : 0 ;

            document.querySelectorAll('.header__menu__nav-site a').forEach( elem => {

                const splitTextElem = elem;
                const splitText = SplitText.create(splitTextElem, {type: "chars, words", charsClass: "char"})
                const link_content = elem.innerHTML;
                elem.innerHTML = '<span class="line">'+link_content+'</span>';
                elem.innerHTML += '<span class="line">'+link_content+'</span>';
                elem.innerHTML += `<svg viewBox="0 0 28 25.8" xml:space="preserve">
                                        <g transform="translate(-7871.062 19814.479)">
                                            <path d="M7871.8-19789.6h18v0.9h-18V-19789.6z"/>
                                            <path d="M7871.1-19807.3h0.9v18.7h-0.9V-19807.3z"/>
                                            <path d="M7898.4-19814.5l0.6,0.7l-26.7,24.7l-0.6-0.7L7898.4-19814.5z"/>
                                        </g>
                                    </svg>`;

                //init rollover
                gsap.set(elem.querySelectorAll('.line:nth-of-type(2) .char'),{y:'115%'})

                elem.addEventListener('mouseenter', () => {
                    if(!elem.classList.contains('disabled')){
                        gsap.to(elem.querySelectorAll('.line:nth-of-type(2) .char'),
                            {y:'0%', duration: .5, delay: 0, ease: 'power2.inOut', stagger: .025})
                        gsap.to(elem.querySelectorAll('.line:nth-of-type(1) .char'),
                            {y:'-115%', duration: .5, delay: 0.025, ease: 'power2.inOut', stagger: .025})
                        gsap.to(elem.querySelector('svg'),{scale: 1, duration: .25, delay: 0.025, ease: 'power2.inOut',})
                    }
                   
                })
                elem.addEventListener('mouseleave', () => {
                    gsap.killTweensOf(elem.querySelectorAll('.char'))
                    gsap.to(elem.querySelectorAll('.line:nth-of-type(1) .char'),
                        {y:'0%', duration: .5, delay: 0, ease: 'power2.inOut', stagger: .025})
                    gsap.to(elem.querySelectorAll('.line:nth-of-type(2) .char'),
                        {y:'115%', duration: .5, delay: 0.025, ease: 'power2.inOut', stagger: .025})
                    gsap.to(elem.querySelector('svg'),{scale: 0, duration: .25, delay: 0.025, ease: 'power2.inOut',})
                })
                
            })

        }

        //rollover menu link footer
        if(document.querySelectorAll('.header__menu__link-footer').length && !onlyOnce){
            setLink('.header__menu__link-footer')
        }

    }

    //setRolloversMenu
    setRolloversAnchors = () => {

        //rollover anchors
        if(document.querySelectorAll('.link-anchor').length){

            const time = (!is_mobile) ? .33 : 0 ;

            document.querySelectorAll('.link-anchor').forEach( elem => {

                if(!elem.classList.contains('link_created')){

                    const splitText = SplitText.create(elem, {type: "chars, words",charsClass: "char"})
                    const link_content = elem.innerHTML;
                    elem.innerHTML = '<span class="line">'+link_content+'</span>';
                    elem.innerHTML += '<span class="line">'+link_content+'</span>';

                    elem.querySelectorAll('.char').forEach( elem => {
                        const charContent = elem.innerHTML;
                        elem.innerHTML = '<span>'+charContent+'</span>';
                    })

                    //init rollover 
                    gsap.set(elem.querySelectorAll('.line:nth-of-type(2) .char span'),{y:'110%'})

                    elem.addEventListener('mouseenter', () => {
                        if(!elem.classList.contains('disabled')){
                            gsap.to(elem.querySelectorAll('.line:nth-of-type(2) .char span'),
                                {y:'0%', duration: .5, delay: 0, ease: 'power2.inOut', stagger: .025})
                            gsap.to(elem.querySelectorAll('.line:nth-of-type(1) .char span'),
                                {y:'-110%', duration: .5, delay: 0.025, ease: 'power2.inOut', stagger: .025})
                        }
                    
                    })
                    elem.addEventListener('mouseleave', () => {
                        if(!elem.classList.contains('disabled')){
                            gsap.killTweensOf(elem.querySelectorAll('.char span'))
                            gsap.to(elem.querySelectorAll('.line:nth-of-type(1) .char span'),
                                {y:'0%', duration: .5, delay: 0, ease: 'power2.inOut', stagger: .025})
                            gsap.to(elem.querySelectorAll('.line:nth-of-type(2) .char span'),
                                {y:'110%', duration: .5, delay: 0.025, ease: 'power2.inOut', stagger: .025})
                        }
                    })

                    elem.classList.add('link_created')

                }
                
            })

        }
        

    }

    //removeRolloversMenu
    // removeRolloversMenu = () => {

    //     if(control) console.log('----remove rollovers menu');
        

    //     //rollover menu proyectos
    //     if(document.querySelectorAll('.header__menu__nav-single__proyectos__item').length){

    //         document.querySelectorAll('.header__menu__nav-single__proyectos__item').forEach( elem => {
    //             gsap.killTweensOf(elem.querySelectorAll('.char'))
    //             gsap.set(elem.querySelectorAll('.char'),{y:'115%'})
                
    //         })

    //     }

    //     //rollover menu site
    //     if(document.querySelectorAll('.header__menu__nav-site a').length){

    //         document.querySelectorAll('.header__menu__nav-site a').forEach( elem => {
    //             gsap.killTweensOf(elem.querySelectorAll('.char'))
    //             gsap.set(elem.querySelectorAll('.char'),{y:'109%'})
    //         })

    //     }

    //     //rollover menu link footer
    //     if(document.querySelectorAll('.header__menu__link-footer').length){
    //          document.querySelectorAll('.header__menu__link-footer').forEach( elem => {
    //             gsap.killTweensOf(elem.querySelectorAll('.char'))
    //             gsap.set(elem.querySelectorAll('.char'),{y:'105%'})
    //         })
    //     }

    // }

    //setRollovers
    setRollovers = () => {

        if(control) console.log('--setRollovers')

        //rollover .btn--bg
        document.querySelectorAll('.btn--bg:not(.btn--menu):not(.header__footer__btn)').forEach( elem => setRolloverBtnBg(elem,true) )

        //setRolloversAnchors
        if(document.querySelector('.mod-header--proyecto')) setRolloversAnchors()

        //rollover links
        if(document.querySelectorAll('.link:not(.header__menu__link-footer)').length){
            setLink('.link:not(.header__menu__link-footer):not(.link_created)')  
        }

        //rollover close
        if(document.querySelectorAll('.close').length){

            const time = (!is_mobile) ? .33 : 0 ;

            document.querySelectorAll('.close').forEach( elem => {

                if(elem.closest('.d-none')){
                    elem.closest('.d-none').classList.add('d-close')
                    elem.closest('.d-none').classList.remove('d-none')
                }

                const size = elem.offsetWidth;
                const spans = elem.querySelectorAll('span')
                const close_tl = gsap.timeline({paused:true})
                
                close_tl.fromTo(spans[1],{x:0, y:0},{x:size, y:-size, duration: .25, ease: 'power3.in'},0)
                close_tl.fromTo(spans[0],{x:0, y:0},{x:-size, y:-size, duration: .25, ease: 'power3.in'},.15)
                close_tl.set(spans[1],{x:-size, y:size},.3)
                close_tl.to(spans[1],{x:0, y:0, duration: .25, ease: 'power3.out'},.3)
                close_tl.set(spans[0],{x:size, y:size},.45)
                close_tl.to(spans[0],{x:0, y:0, duration: .25, ease: 'power3.out'},.45)

                elem.addEventListener('mouseenter', () => {
                    close_tl.play()
                })
                elem.addEventListener('mouseleave', () => {
                    close_tl.reverse()
                })

                if(elem.closest('.d-close')){
                    elem.closest('.d-close').classList.add('d-none')
                    elem.closest('.d-close').classList.remove('d-close')
                }
                
            })

        }

        //rollover close modal alert
        if(document.querySelectorAll('.modal--alert__close').length){

            const time = (!is_mobile) ? .33 : 0 ;

            document.querySelectorAll('.modal--alert__close').forEach( elem => {

                const close_tl = gsap.timeline({paused:true})
                close_tl.to(elem,{rotation: '90deg', duration: .33, ease: 'power3.inOut'},0)

                elem.addEventListener('mouseenter', () => {
                    close_tl.play()
                })
                elem.addEventListener('mouseleave', () => {
                    close_tl.reverse()
                })
                
            })

        }

        //rollover Maps
        if(document.querySelectorAll('.mod-media__maps').length){
            document.querySelectorAll('.mod-media__maps').forEach( elem => {

                let timeOut;

                elem.addEventListener('mouseenter', () => {
                    timeOut = setTimeout(() => {
                        // console.log('mouseenter');
                        gsap.to(cursor,{opacity:0,duration:.15})
                        elem.querySelector('iframe').classList.add('on')
                    }, 500);
                    
                })
                elem.addEventListener('mouseleave', () => {
                    // console.log('mouseleave');
                    clearTimeout(timeOut)
                    gsap.to(cursor,{opacity:1,duration:.15})
                    elem.querySelector('iframe').classList.remove('on')
                })

            } )
        }


    }
    

});

