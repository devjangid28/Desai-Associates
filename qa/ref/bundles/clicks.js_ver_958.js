
window.addEventListener('DOMContentLoaded', ()=>{ 
    
    setRolloversMenu()

    //open & close menu
    if(document.querySelectorAll('.btn--menu').length){
        openMenu = false;
        const btnMenu = document.querySelector('.btn--menu');
        const title = document.querySelector('.header__menu__nav-single__title');
        const viewAll = document.querySelector('.header__menu__nav-single__link');
        const proyectos = document.querySelectorAll('.header__menu__nav-single__proyectos__item .line:nth-of-type(1) span.title, .header__menu__nav-single__proyectos__item .line:nth-of-type(1) div.place');
        const menu_site = document.querySelectorAll('.header__menu__nav-site li');
        const link_footer = document.querySelector('.header__menu__link-footer');
        const header_media = document.querySelector('.header__menu__media')
        const header_media_title = document.querySelector('.header__menu__media__title')
        gsap.set(document.querySelectorAll('.header__menu__nav-single__proyectos__item .line:nth-of-type(2) .num'),{opacity:0})

        //split
        const title_split = SplitText.create(title, {type: "chars, words",charsClass: "char"})
        const header_media_title_split = SplitText.create(header_media_title, {type: "chars, words",charsClass: "char"})

        if(control )console.log('btnAnchors',btnAnchors);
        

        //menu_tl
        menu_tl = gsap.timeline({paused: true,
            onStart: () => {
                menu.classList.remove('d-none')
                menu.style.transform = '';
                gsap.set(btnMenu, { '--color': 'var(--blue)'});
                gsap.to(btnMenu.querySelector('span > span'),{y:'120%', duration: 0.33,  ease:"power2.out", 
                    onComplete: ()=>{
                        btnMenu.querySelector('span > span').innerHTML = 'Cerrar';
                        gsap.fromTo(btnMenu.querySelector('span > span'),{y:'-120%'},{y:'0%', duration: 0.33,  ease:"power2.out"})
                    }
                })

                if(document.querySelector('.modal--alert') && alert_tl) alert_tl.timeScale(2).reverse()
                
            },
            onReverseComplete: () => {
                menu.classList.add('d-none')
                gsap.set(btnMenu, { '--color': 'var(--beige)'});
                gsap.to(btnMenu.querySelector('span > span'),{y:'120%', duration: 0.33,  ease:"power2.out", 
                    onComplete: ()=>{
                        btnMenu.querySelector('span > span').innerHTML = 'Menú';
                        gsap.fromTo(btnMenu.querySelector('span > span'),{y:'-120%'},{y:'0%', duration: 0.33,  ease:"power2.out"})
                        
                    }
                })
                // removeRolloversMenu();

            },

        });

        ///set animations
        menu_tl.to('.header__menu__bg', { width: '100vw', duration: 0.75,  ease:"power2.out"},0);
        menu_tl.to(btnAnchors, { opacity: '0', duration: 0.4,  ease:"power2.out", 
            onComplete: ()=>{
                if(control) console.log('chaptersAll onComplete', chaptersAll);
                if(chaptersAll.length) btnAnchors.classList.add('d-none')
            },
            onReverseComplete: ()=>{
                if(control) console.log('chaptersAll onReverseComplete', chaptersAll);
                if(chaptersAll.length) btnAnchors.classList.remove('d-none')
                
            }
        },.1);

        
        if(!is_mobile){
            ///desktop

            //anim media
            const init_media = .215;
            menu_tl.from( header_media.querySelector('.media'),{'--clipPath':'0% 0% 0% 100%', duration: .75, ease: 'power2.out'},init_media)
            menu_tl.from( header_media.querySelector('.media__wrap-source'),{x:'35%', duration: 1.1, ease: 'power2.out'},init_media)
            menu_tl.from( header_media_title.querySelectorAll('.char'),{y:'105%', duration: .65, stagger: 0.033, ease: 'power3.out'},init_media+0.35)

            menu_tl.from(title.querySelectorAll('.char'),{y:'105%', duration: 1, ease: 'power3.out'},.3)
            menu_tl.from(viewAll,{x:'25%', opacity: 0, duration: 1, ease: 'power3.out'},.7)

            //anim_projects
            proyectos.forEach( (elem,index) => {
                menu_tl.from(document.querySelectorAll('.header__menu__nav-single__proyectos__item .line:nth-of-type(1) .num')[index],
                    {y:'120%', duration: .65, stagger: 0.025, ease: 'power3.out'},.95+(.15*index))
                menu_tl.set(elem.querySelectorAll('.line:nth-of-type(2) .char'),{y:'115%'})
                menu_tl.fromTo(elem.querySelectorAll('.line:nth-of-type(1) .char'),
                    {y:'115%'},{y:'0%', duration: .65, stagger: 0.025, ease: 'power3.out'},.95+(.15*index))
            } )
            //anim_links site
            menu_site.forEach( (elem,index) => {
                menu_tl.fromTo(elem.querySelectorAll('.line:nth-of-type(1)'),{y:'105%'},{y:'0%', duration: .85, ease: 'power3.out'},1+(.1*index))
                
            } )
            menu_tl.from(link_footer.querySelectorAll('.char'),{y:'105%', duration: .65, stagger: 0.02, ease: 'power3.out'},1.4)

        
        }else{
            ///mobile

            menu_tl.from(title.querySelectorAll('.char'),{y:'105%', duration: 1, ease: 'power3.out',onStart:()=>{
                if(control) console.log('--start menu_tl');
                // if(control) console.log('modscroll',document.querySelector('.mod-scroll'));
                // if(control) console.log('header_logo_tl.progress()',header_logo_tl.progress());
                // if(document.querySelector('.mod-scroll') && header_logo_tl.progress() == 0) header_logo_tl.play()
            }},.45)
            menu_tl.from(viewAll,{x:'25%', opacity: 0, duration: 1, ease: 'power3.out'},.7)

            //anim_projects
            proyectos.forEach( (elem,index) => {
                menu_tl.from(document.querySelectorAll('.header__menu__nav-single__proyectos__item .line:nth-of-type(1) .num')[index],
                    {y:'120%', duration: .5, stagger: 0.015, ease: 'power3.out'},1+(.15*index))
                menu_tl.set(elem.querySelectorAll('.line:nth-of-type(2) .char'),{y:'115%'},'<')
                menu_tl.fromTo(elem.querySelectorAll('.line:nth-of-type(1) .char'),
                    {y:'115%'},{y:'0%', duration: .5, stagger: 0.015, ease: 'power3.out'},'<')
            } )

            //anim media
            menu_tl.from( header_media.querySelector('.media'),{'--clipPath':'0% 0% 0% 100%', duration: .75, ease: 'power2.out'},1.5)
            menu_tl.from( header_media.querySelector('.media__wrap-source'),{x:'35%', duration: 1.1, ease: 'power2.out'},1.5)
            menu_tl.from( header_media_title.querySelectorAll('.char'),{y:'105%', duration: .65, stagger: 0.033, ease: 'power3.out'},1.8)

            menu_tl.from(link_footer.querySelectorAll('.char'),{y:'105%', duration: .65, stagger: 0.02, ease: 'power3.out',
                 onReverseComplete:()=>{
                    if(control) console.log('--reverse menu_tl');
                    // if(document.querySelector('.mod-scroll') && header_logo_tl.progress() > 0 && !openMenu) header_logo_tl.reverse()
                }
            },2)

            //anim_links site
            menu_site.forEach( (elem,index) => {
                menu_tl.fromTo(elem.querySelectorAll('.line:nth-of-type(1)'),{y:'105%'},{y:'0%', duration: .85, ease: 'power3.out'},2.2+(.1*index))
            } )
            

        }
        

        ////menu_close_tl
        // menu_close_tl = gsap.timeline({paused: true,
        //     onReverseComplete: () => {
        //         menu.classList.add('d-none')
        //         gsap.set(btnMenu, { '--color': 'var(--beige)'});
        //         gsap.to(btnMenu.querySelector('span > span'),{y:'120%', duration: 0.33,  ease:"power2.out", 
        //             onComplete: ()=>{
        //                 btnMenu.querySelector('span > span').innerHTML = 'Menú';
        //                 gsap.fromTo(btnMenu.querySelector('span > span'),{y:'-120%'},{y:'0%', duration: 0.33,  ease:"power2.out"})
        //             }
        //         })
        //     },
        // });
        // menu_close_tl.from(menu, { x: '100%', duration: .75,  ease:"power3.in"});
            
        ///click Menu
        const clickMenu = () => { 
            if(control) console.log('openMenu',openMenu);
            if( !openMenu ){ 
                // proyectos.forEach( elem => { elem.classList.remove('disabled') } )
                // menu_site.forEach( elem => { elem.classList.remove('disabled') } )
                openMenu = true; menu_tl.progress(0).timeScale(1).play()
            }else{ 
                // proyectos.forEach( elem => { elem.classList.add('disabled') } )
                // menu_site.forEach( elem => { elem.classList.add('disabled') } )
                openMenu = false; menu_tl.timeScale(2).reverse()
            }
        }
        ////
        btnMenu.addEventListener('click',(ev)=>{
            ev.preventDefault();
            clickMenu();
        });

        /// remove menu on click href
        // menu.querySelectorAll('a[href]').forEach( elem => {
        //     elem.addEventListener('click',(ev)=>{
        //         clickMenu();
        //     });
        // } )

        /// to show menu
        // clickMenu();
    }

    //setClicks
    setClicks = () => {

        //click header_logo
        if(!onlyOnce){
             header_logo_normal.addEventListener('click',()=>{
                if(control) console.log('click header_logo_normal');
                if(!header_logo_normal.classList.contains('disabled'))
                    // header_logo_normal.closest('.logo').querySelector('a').click()
                    swup.navigate(header_logo.getAttribute('data-url'))
            })
        }

        //open & close modal contacto
        if(document.querySelectorAll('a[href="contacto"],a[href="http://contacto"],a[href="https://contacto"]').length){
            const open_contacto = document.querySelectorAll('a[href="contacto"],a[href="http://contacto"],a[href="https://contacto"]');
            const close_contacto = contacto.querySelector('.modal__close');

            if(!contacto_tl){
                const split_title = SplitText.create(contacto.querySelector('.modal__content__title'), {type: "words,chars",wordsClass: "word" })
                contacto_tl = gsap.timeline({paused:true,
                    onStart: () => { contacto.classList.remove('d-none') },
                    onReverseComplete: () => { contacto.classList.add('d-none') },
                });
                contacto_tl.from(contacto,{opacity: 0, duration: .75, ease: 'power1.inOut'},.0)
                contacto_tl.from(contacto_content,{opacity: 0,y:'50%', duration: .75, ease: 'power3.out'},.5)
                contacto_tl.from(split_title.chars,{y:'100%', duration: .65, stagger: 0.02, ease: 'power3.out'},.75)

                close_contacto.addEventListener('click',() => {
                    if(control) console.log('close_contacto');
                    if(lenis) lenis.start()
                    contacto_tl.reverse()
                })
            }
            

            ///
            open_contacto.forEach( elem => {
                elem.addEventListener('click',(ev) => {
                    ev.preventDefault();
                    if(lenis) lenis.stop();
                    if(control) console.log('open_contacto');
                    contacto_tl.play()
                    ///set _wpcf7_container_post
                    if( document.querySelector('main').getAttribute('data-id') ){
                        const form = contacto.querySelector('.wpcf7-form');
                        //reinicio el form
                        document.querySelector('.wpcf7-response-output').innerHTML = '';
                        document.querySelectorAll('.modal__content__form__label.on').forEach( elem => elem.classList.remove('on') )
                        //reconfiguro el form
                        document.querySelector('input[name="_wpcf7_container_post"]').setAttribute('value',document.querySelector('main').getAttribute('data-id') );
                        form.querySelector('input[name="pagina"]').setAttribute('value',document.querySelector('main').getAttribute('data-name') );
                        form.querySelector('input[name="destinatarios"]').setAttribute('value',document.querySelector('main').getAttribute('data-recipient') );
                        
                    }
                       
                })
            })
            
        }
        
        //open & close modal media
        if(document.querySelectorAll('.media__wrap-source.video').length){
            
            const modalMedia = document.querySelector('.modal--media');
            const modalMedia_content = modalMedia.querySelector('.modal__content');
            const modalMedia_close = modalMedia.querySelector('.modal__close');
            const modalMedia_tl = gsap.timeline({paused:true,
                onStart: () => { 
                    modalMedia.classList.remove('d-none') 
                    if(lenis) lenis.stop();
                },
                onReverseComplete: () => { 
                    modalMedia.classList.add('d-none') 
                    if(lenis) lenis.start();
                },
                onComplete: ()=>{ 
                    if(modalMedia.querySelectorAll('video').length)
                        modalMedia_tl.querySelector('video').play() 
                },
            });

            modalMedia_tl.fromTo(modalMedia,{opacity: 0},{opacity: 1, duration: .5, ease: 'power2.inOut'})
            modalMedia_tl.fromTo(modalMedia_content,{opacity: 0,y:'50%'},{opacity: 1, y:'0%',duration: .5, delay: -.15, ease: 'power2.out'})
            // modalMedia_tl.fromTo(modalMedia_close,{opacity: 0},{opacity: 1,duration: 1, delay: -.5,  ease: 'power2.out'})

            modalMedia_close.addEventListener('click',() => {
                if(control) console.log('close_modalMedia');
                modalMedia_tl.reverse()
                if(modalMedia.querySelectorAll('video').length){ 
                    modalMedia.querySelector('video').pause() 
                }else{
                    video = modalMedia.querySelector('iframe')
                    video_src = video.src
                    setTimeout(() => {
                        video.src = video_src;
                    }, 500);
                }
            })

            document.querySelectorAll('.media__wrap-source.video').forEach(elem=>{

                elem.addEventListener('click', (ev) => { 
                    modalMedia.querySelector('.modal__video').innerHTML = elem.getAttribute('data-video');
                    modalMedia_tl.play() 
                })

            })
        }

        //open & close modal dispobilidad
        if(document.querySelectorAll('a[href="disponibilidad"],a[href="http://disponibilidad"],a[href="https://disponibilidad"]').length && document.querySelector('.modal--avaliable')){

            const disponibilidad = document.querySelector('.modal--avaliable');
            const disponibilidad_content = disponibilidad.querySelector('.modal__content');
            const open_disponibilidad = document.querySelectorAll('a[href="disponibilidad"],a[href="http://disponibilidad"],a[href="https://disponibilidad"]');
            const close_disponibilidad = disponibilidad.querySelector('.modal__close');

            const split_title = SplitText.create(disponibilidad.querySelector('.modal__content__title'), {type: "words,chars",wordsClass: "word" })

            const disponibilidad_tl = gsap.timeline({paused:true,
                onStart: () => { disponibilidad.classList.remove('d-none') },
                onReverseComplete: () => { disponibilidad.classList.add('d-none') },
            });
            disponibilidad_tl.from(disponibilidad,{y:'100%', duration: 1.25, ease: 'power3.out'},0)
            disponibilidad_tl.from(disponibilidad_content,{opacity: 0, duration: 1, ease: 'power3.out'},.25)
            disponibilidad_tl.from(split_title.chars,{y:'100%', duration: .65, stagger: 0.02, ease: 'power3.out'},.25)
      
            open_disponibilidad.forEach( elem => {
                elem.addEventListener('click',(ev) => {
                    ev.preventDefault();
                    anclas_close_tl.progress(0).play()
                    if(lenis) lenis.stop();
                    if(control) console.log('open_disponibilidad');
                    disponibilidad_tl.play()
                })
            })
            close_disponibilidad.addEventListener('click',() => {
                if(control) console.log('close_disponibilidad');
                if(lenis) lenis.start();
                disponibilidad_tl.reverse()
            })
        }

        //open & close modal anclas
        if(document.querySelectorAll('.header__footer__btn').length && document.querySelector('.modal--anchors')){

            const anclas = document.querySelector('.modal--anchors');
            const anclas_content = anclas.querySelector('.anchors__content');
            const anchors = anclas.querySelectorAll('.anchors__nav__link')
            const open_anclas = document.querySelector('.header__footer__btn');
            const close_anclas = anclas.querySelector('.anchors__close');
            
            anclas_tl = gsap.timeline({paused:true,
                onStart: () => { 
                    anclas.classList.remove('d-none') 
                },
            });

            anclas_tl.from(anclas,{opacity: 0,y:'50%', duration: .75, ease: 'power3.out'},0)
            anclas_tl.from(anclas_content,{height:'50px', duration: .75, ease: 'power3.out'},.35)
            anclas_tl.from(anclas.querySelector('.anchors__title'),{opacity: 0,y:'100%', duration: .5, ease: 'power3.out'},.65)
            anchors.forEach( (elem,index) => {
                anclas_tl.fromTo(elem.querySelector('span:nth-of-type(1)'),{y:'125%'},{y:'0%', duration: .65, stagger: 0.025, ease: 'power3.out'},.75+(index*.1))
                anclas_tl.fromTo(elem.querySelectorAll('.link-anchor .line:nth-of-type(1) .char'),{y:'110%'},{y:'0%', duration: .65, stagger: 0.025, ease: 'power3.out'},.85+(index*.1))
            })
            anclas_tl.from(anclas.querySelector('.anchors__footer'),{opacity: 0,y:'50%', duration: .5, ease: 'power3.out'},1.25)
            
            ///close
            anclas_close_tl = gsap.timeline({paused:true,
                onComplete: () => { 
                    anclas_tl.progress(.0001).reverse()
                    anclas.classList.add('d-none')
                },
            });
            anclas_close_tl.to(anclas,{opacity: 0,y:'50%', duration: .75, ease: 'power3.in'},0)
            
            ///clicks
            open_anclas.addEventListener('click',(ev) => {
                ev.preventDefault();
                anclas_tl.progress(0).play()
            })
            close_anclas.addEventListener('click',() => {
                anclas_close_tl.progress(0).play()
            })
        }

        //scrollTop
        if(document.querySelectorAll('.link--top').length){
            document.querySelectorAll('.link--top').forEach( elem => {

                elem.addEventListener('click',(ev) => {
                    ev.preventDefault();
                    if(!is_mobile){
                        lenis.scrollTo(0,0)
                        // gsap.set(smoother, {
                        //     scrollTop: 0,
                        // });
                    }else{
                        smoothWrapper.scrollTo({
                            top: 0,
                            left: 0,
                            behavior: 'instant'
                        });
                        changeButtonAnchors(false)
                    }
                })

            } )
        }

        //set clicks proyects in mobile
        if(document.querySelectorAll('.mod-scroll__projectInt').length && is_mobile){
            document.querySelectorAll('.mod-scroll__projectInt').forEach( elem => {

                elem.addEventListener('click',(ev) => {
                    if(elem.getAttribute('data-url')){
                        elem.querySelector('.btn--circle').click()
                    }
                })

            } )
        }

        //set clicks expand_mouse on mobile
         if(document.querySelectorAll('.expand_mouse').length && is_mobile){
            document.querySelectorAll('.expand_mouse').forEach( elem => {

                elem.addEventListener('click',(ev) => {
                    if(elem.getAttribute('data-url')){
                        elem.querySelector('.btn--circle').click()
                    }
                })

            } )
        }

        //anchors
        if(!is_mobile){
            let urlHash = window.location.href.split("#")[1];
            let scrollElem = document.querySelector("#" + urlHash);
            if (urlHash && scrollElem) {
                lenis.scrollTo(scrollElem, {duration:.0001} )
            }
            /// on click anchors
            document.querySelectorAll('.anchors__nav__link').forEach((elem) => {
                elem.addEventListener("click", (ev) => {
                    ev.preventDefault();
                    ev.stopImmediatePropagation();
                    anclas_close_tl.progress(0).play()

                    // lenis.scrollTo( elem.getAttribute('href'), {duration:.0001} )
                    lenis.scrollTo(elem.getAttribute('href'), {duration:.01, offset: -250, onComplete: ()=>{
                        if(control) console.log('lenis scrollTo completado');
                        lenis.scrollTo(elem.getAttribute('href'),{duration:1, offset: -50})
                    }} )

                    changeButtonAnchors(false)

                },true);
            });
        }else{
            /// on click anchors
            document.querySelectorAll('.anchors__nav__link').forEach((elem) => {
                elem.addEventListener("click", (ev) => {
                    ev.preventDefault();
                    anclas_close_tl.progress(0).play()
                    smoothWrapper.scrollTo({
                        top: document.querySelector(elem.getAttribute('href')).closest('section').offsetTop - 50,
                        left: 0,
                        behavior: 'instant'
                    });
                    changeButtonAnchors(false)
                });
            });
        }

    }

})
