
document.addEventListener('DOMContentLoaded', () => {

    let sections, scrollH, scrollH_width, scrollHTrigger, triggerProjects, triggerLastProject, triggerCierre, triggerIntro, lastProject_content_tl;
    const sizeProjects = 220;
    const adjust = 50;
    const heightItem = 33.33;
    const maxWidthItem = 60;
    const widthCarouselLast = 42.5;


    //restScroll
    const restScroll = () => {

        const scroll_logo_normal = document.querySelector('.mod-scroll__intro .logo__normal')
        scroll_logo_normal.addEventListener('click',()=>{
            if(control) console.log('click scroll_logo_normal');
            if(!scroll_logo_normal.classList.contains('disabled'))
                // scroll_logo_normal.closest('.logo').querySelector('a').click()
                swup.navigate(scroll_logo_normal.getAttribute('data-url'))
        })

         //scrolltrigger to show logo small and btn menu
        if(document.querySelector('.mod-scroll__intro')){ 
       
            if(!is_mobile){
                let startTl = "125% 0%";
                triggerHeaderLogo = ScrollTrigger.create({
                    containerAnimation: scroll_tl,
                    trigger: document.querySelector('.mod-scroll__intro'),
                    start: startTl,
                    onEnter: () => {
                        // console.log('onEnter header_logo_tl');
                        // console.log( document.querySelector('.mod-scroll__intro'));
                        if(document.querySelector('.mod-scroll__intro')) header_logo_tl.progress(0).play()
                        if(!is_mobile) header_btn_tl.timeScale(1).play()
                    },
                    onEnterBack: () => {
                        // console.log('onEnterBack header_logo_tl');
                        // console.log( header_logo_normal.classList);
                        
                        if(document.querySelector('.mod-scroll__intro') && !header_logo_normal.classList.contains('disabled')) header_logo_tl.reverse()
                        if(!is_mobile) header_btn_tl.timeScale(1.75).reverse()
                    },
                    // toggleActions: 'play none none reverse',
                    // markers: true,
                })
            }else{
                header_btn_tl.timeScale(1).play()
            }

        }
        
        //setFlips
        setFlips()

        //anima mod-scroll__text
        if(document.querySelectorAll('.mod-scroll__text').length){

            document.querySelectorAll('.mod-scroll__text').forEach( elem => {

                const lines = elem.querySelectorAll('.line')
                lines.forEach(el => {
                    const content = el.innerHTML;
                    el.innerHTML = '<span class="cont">'+content+'</span>';
                })

                const posInitLeft = lines[3].querySelector('span.cont').offsetWidth - lines[3].offsetWidth;
                const title_tl = gsap.timeline({paused:true})
                title_tl.from(lines[3].querySelector('span.cont'),
                    {left: posInitLeft, duration: 2, ease: 'power1.inOut'},0)

                const textTrigger = ScrollTrigger.create({
                    containerAnimation: scroll_tl,
                    animation: title_tl,
                    trigger: elem,
                    start: "0% 50%",
                    end: "100% 50%",
                    scrub: 0,
                    // toggleActions: 'play none none reverse',
                    // markers: true,
                })

            })

        }

        //anima mod-scroll__images-text
        if(document.querySelectorAll('.mod-scroll__images-text').length){

            document.querySelectorAll('.mod-scroll__images-text').forEach( elem => {

                const imagesText = elem.querySelector('.mod-scroll__images-text__text p');
                const spliText = new SplitText(imagesText,{type: "lines"})

                const imagesText_tl = gsap.timeline({paused:true})
                imagesText_tl.from(spliText.lines,{opacity:.2, duration:.2, stagger: .1})

                ScrollTrigger.create({
                    containerAnimation: scroll_tl,
                    animation: imagesText_tl,
                    trigger: imagesText,
                    start: "0% 75%",
                    end: "0% 25%",
                    scrub: 0,
                    // toggleActions: 'play none none reverse',
                    // markers: true,
                })

            })

        }

        //anima mod-scroll__carousel
        if(document.querySelectorAll('.mod-scroll__carousel').length){

            document.querySelectorAll('.mod-scroll__carousel').forEach( elem => {

                const carousel = elem.querySelector('.mod-scroll__carousel__content')
                const carousel_tl = gsap.timeline({paused:true})
                if(!is_mobile){
                    // carousel_tl.fromTo(carousel,{x:'0'},{x:'-1.45em',ease:'none'},0)
                    carousel_tl.from(carousel,{y:'175vh',ease:'none'},0)
                }else{
                    carousel_tl.fromTo(carousel,{x:'0'},{x:'-3em',ease:'none'},0)
                    // carousel_tl.to(carousel,{y:'-100%',ease:'none'},0)
                }
                

                ScrollTrigger.create({
                    containerAnimation: scroll_tl,
                    animation: carousel_tl,
                    trigger: elem,
                    start: "0% 95%",
                    end: "100% 0%",
                    scrub: .5,
                    // toggleActions: 'play none none reverse',
                    // markers: true,
                })

            })

        }

        //anima mod-scroll__terms
        if(document.querySelectorAll('.mod-scroll__terms').length && !is_mobile){

            document.querySelectorAll('.mod-scroll__terms').forEach( elem => {

                //fix width section
                gsap.set(elem,{width: elem.offsetWidth})

                //anima parallax terms
                const terms = elem.querySelectorAll('.mod-scroll__terms__term')
                const terms_tl = gsap.timeline({paused:true})
                terms_tl.to(terms[0],{paddingLeft:'12vw'},0)
                terms_tl.to(terms[1],{paddingRight:'3vw'},0)
                terms_tl.to(terms[1].querySelector('.mod-scroll__terms__term__text'),{marginRight:'3vw'},0)
                terms_tl.to(terms[2],{paddingLeft:'20vw'},0)

                ScrollTrigger.create({
                    containerAnimation: scroll_tl,
                    animation: terms_tl,
                    trigger: elem,
                    start: "0% 100%",
                    end: "100% 0%",
                    scrub: 1,
                    // toggleActions: 'play none none reverse',
                    // markers: true,
                })

                ///changes images terms
                const termImages = elem.querySelectorAll('.mod-scroll__terms .follow__mouse > img')
                const termText = elem.querySelectorAll('.mod-scroll__terms__term__text-group .mod-scroll__terms__term__text__single')
                
                let termIndex, termIndexOld = 1;
                elem.querySelectorAll('.mod-scroll__terms__term').forEach( (el,index) => {

                    el.addEventListener('mouseenter',() => {

                        if(termIndex != index){
                            termIndex = index;
                            if(document.querySelector('.mod-scroll__terms .follow__mouse > img.prev'))
                                document.querySelector('.mod-scroll__terms .follow__mouse > img.prev').classList.remove('prev')
                            if(document.querySelector('.mod-scroll__terms .follow__mouse > img.on')){
                                document.querySelector('.mod-scroll__terms .follow__mouse > img.on').classList.add('prev')
                                document.querySelector('.mod-scroll__terms .follow__mouse > img.on').classList.remove('on')
                            }
                                
                            termImages[index].classList.add('on')
                            gsap.from( termImages[index],{'--clipPath':'100% 0% 0% 0%', duration: 1.25, ease: 'power3.out'})
                            gsap.from( termImages[index],{scale: 2, duration: 2, delay: -.75, ease: 'power2.out'})
                            gsap.to( termText[termIndexOld],{opacity: 0, y:'-50%', duration: .33, ease: 'power2.in'})
                            gsap.fromTo( termText[index],{opacity: 0, y:'50%'},{opacity: 1,  y:'0%', duration: .33, ease: 'power2.out'},'<+=.33')
                            termIndexOld = termIndex;
                        }
                        
                    })

                } )

            })

        }

        ////anima mod-scroll__projects__text
        if(document.querySelectorAll('.mod-scroll__projects__text').length){

            document.querySelectorAll('.mod-scroll__projects__text').forEach( elem => {

                const split = SplitText.create(elem, {type: "lines", linesClass:'line'})
                split.lines.forEach(elem => {
                    const content = elem.innerHTML;
                    elem.innerHTML = '<span class="w-100">'+content+'</span>';
                })
                const paragraph_tl = gsap.timeline({paused:true})
                paragraph_tl.from(elem.querySelectorAll('span'),{y:'100%', duration: .5, stagger: 0.09, ease: 'power3.easeOut'})

                ScrollTrigger.create({
                    containerAnimation: scroll_tl,
                    animation: paragraph_tl,
                    trigger: elem,
                    start: "left 75%",
                    // toggleActions: 'play none none reverse',
                    // markers: true,
                })

            }) 

        }

        ///anima mod-scroll__projects__item.last-item
        if(document.querySelectorAll('.mod-scroll__projects__item.last-item').length){

            lastProject_content_tl = gsap.timeline({paused:true});
            const splitTitle = SplitText.create(document.querySelector('.last-item__content__title'), {type: "chars, words",charsClass:'char'})
            const splitText = SplitText.create(document.querySelector('.last-item__content__text > p'), {type: "lines", linesClass:'line'})
            splitText.lines.forEach(elem => {
                const content = elem.innerHTML;
                elem.innerHTML = '<span class="w-100">'+content+'</span>';
            })
            lastProject_content_tl.from('.last-item__content__section',{opacity: 0, y:'100%', duration: .33})
            document.querySelectorAll('.last-item__content__title .line').forEach( (el,ind) => {
                const posInit = (ind%2!=0) ? '-110%' : '110%';
                lastProject_content_tl.from(el.querySelectorAll('.char'),{y:posInit, duration: .65, stagger: 0.03, ease: 'power3.out'},"<+=.2")
            } )
            lastProject_content_tl.from(document.querySelectorAll('.last-item__content__text span'),{y:'100%', duration: .5, stagger: 0.09, ease: 'power3.easeOut'},"<+=.33")

            if(is_mobile){

                const lastProject = document.querySelector('.mod-scroll__projects__item.last-item');
                const lastProject_carouselContent = lastProject.querySelector('.last-item__content');

                ScrollTrigger.create({
                    containerAnimation: scroll_tl,
                    // animation: lastProject_content_tl,
                    trigger: lastProject_carouselContent,
                    start: "15% bottom",
                    // toggleActions: 'play none none reverse',
                    onEnter: ()=>{ lastProject_content_tl.timeScale(1.25).play(); if(control) console.log('enter');
                     },
                    // markers: true,
                })

            }
            
        }

        //anima mod-scroll__projectInt
        if(document.querySelectorAll('.mod-scroll__projectInt').length > 0){
                
            document.querySelectorAll('.mod-scroll__projectInt').forEach( (elem) => {

                ///move big image 
                const imageInt = elem.querySelector('.flipMedia__media.flipMedia__media--up');
                const projectInt_image_tl = gsap.timeline({paused:true});
                projectInt_image_tl.to(imageInt.querySelector('.media__source'),{x: '-15%'})

                ScrollTrigger.create({
                    containerAnimation: scroll_tl,
                    animation: projectInt_image_tl,
                    trigger: elem,
                    start: "0% 100%",
                    end: "75% 100%",
                    scrub: .5,
                    // markers: true,
                    onEnter: () => {
                        if(triggerCierre) triggerCierre.refresh();
                        if(triggerFlipCierreImage) triggerFlipCierreImage.refresh();
                    },
                })

                ///change spacing text and show year
                const title = elem.querySelector('.mod-scroll__projectInt__title');
                const splitTitle = new SplitText(title,{type: "words"})
                const year = elem.querySelector('.mod-scroll__projectInt__section');
                year.classList.add('clip-y')
                const splitYear = new SplitText(year,{type: "words", wordsClass: 'word'})

                const projectInt_title_tl = gsap.timeline({paused:true});
                projectInt_title_tl.to(title.querySelector('div:nth-of-type(1)'),{
                    marginRight: 25, duration: 3, ease: 'power3.inOut'
                })
                projectInt_title_tl.from(year.querySelector('.word'),{
                    y: '100%', duration: 1.25, ease: 'power2.out'
                },'<')

                ScrollTrigger.create({
                    containerAnimation: scroll_tl,
                    animation: projectInt_title_tl,
                    trigger: elem,
                    start: "65% 100%",
                    toggleActions: 'play none none reverse',
                    // markers: true,
                })
                
            })
            
        }


    }
    
    //setScrollH
    setScrollH = () => {

        if(control) console.log('--- set setScrollH');

        //destroy all scrolltrigger about scroll
        const allTriggers = ScrollTrigger.getAll()
        allTriggers.forEach(
            elem => {   
                //refresh only not have mod-scroll in trigger
                if(elem.trigger){
                    const list = elem.trigger.classList.value.split(' ');
                    if(list.filter(el => el.includes('mod-scroll')).length == 1){
                        elem.kill();
                    }
                }
            }
        )
        
        //set scroll_tl
        if(!is_mobile) scroll_tl = gsap.timeline({paused:true})

        ///anima scroll-intro && show header logo
        if(document.querySelector('.mod-scroll__intro')){

            scroll_intro_tl = gsap.timeline({paused:true, 
                onStart: ()=>{
                    if(control) console.log('--start scroll_intro_tl');
                    
                },
                onComplete: ()=>{
                    if(triggerProjects) triggerProjects.refresh()

                    //set rest init
                    restInit()

                    ///set rest animations
                    restScroll()
                }
            });

            // scroll_intro_tl.set('.logo__normal',{ opacity:1 },0)

            scroll_intro_tl.to(header_logo,{ width:'100%', duration: 1, ease: 'power2.in(2)' },.25)
            scroll_intro_tl.to('.header__percent',{ opacity:0, duration: .5,  ease: 'linear' },.25)
            scroll_intro_tl.to('.header__progress',{opacity:0, duration: .33, ease: 'linear'},.25)
            scroll_intro_tl.to(header_logo,{ height:'100%', duration: 1, ease: 'power2.out(2)',onComplete: ()=>{
                if(!is_mobile){
                    //change header logo
                    if(document.querySelector('.mod-scroll__intro.bg-black'))
                        document.querySelector('.mod-scroll__intro__logo').classList.remove('c-black')
                    gsap.set(header_logo_normal,{opacity:0})
                    gsap.set(header_logo_group,{opacity:0,onComplete:()=>{ 
                        header_logo_normal.classList.add('d-none') 
                    }})
                    gsap.set(document.querySelector('.mod-scroll__intro__logo'),{opacity:1})
                }
                header_logo_normal.classList.remove('disabled')
            }},'<+=1.75')
            scroll_intro_tl.to(header_logo_normal,{ top:posLogoMobile, duration: 1.75, ease: 'power2.out'},'<')

            //anim titles intro
            document.querySelectorAll('.mod-scroll__intro__title').forEach( (elem,index) => {
                const split = SplitText.create(elem, {type: "lines,chars", linesClass:'splitline clip-y', charsClass:'char'})
                elem.querySelectorAll('.splitline').forEach( (el,ind) => {
                    const posInit = (ind%2!=0) ? '-110%' : '110%';
                    const delayTime = (ind==0) ? "<+=.05" : "<+=.05" ;
                    scroll_intro_tl.from(el.querySelectorAll('.char'),{y:posInit, duration: .65, stagger: 0.03, ease: 'power3.out'},delayTime)
                } )
                
            })

            //anim paragraph intro
            document.querySelectorAll('.mod-scroll__intro__text p').forEach( elem => {
                const split = SplitText.create(elem, {type: "lines",linesClass:'splitline clip-y'})
                split.lines.forEach(elem => {
                    const content = elem.innerHTML;
                    elem.innerHTML = '<span>'+content+'</span>';
                })
                scroll_intro_tl.from(elem.querySelectorAll('span'),{y:'100%', duration: .5, stagger: 0.09, ease: 'power3.easeOut'},"<+=.05")
            })

            //anim width & image 
            if(!is_mobile){
                scroll_intro_tl.fromTo(document.querySelector('.mod-scroll__intro > .wrapper'),
                    {width:'100vw'},{width:'80vw', duration: 1.25,  ease: 'power3.out', onStart: () => {

                        //if next module is .mod-scroll__images move image and set trigger
                        const elems_scroll = document.querySelectorAll('.mod-scroll > *')
                        if(elems_scroll[1].classList.contains('mod-scroll__images')){

                            //move image
                            const image = elems_scroll[1].querySelector('.mod-scroll__images__image-single')
                            gsap.fromTo(image,{x:'-5vw'},{x:'-15vw', duration: 1.25,  ease: 'power2.out', 
                                onComplete: ()=>{

                                    //set trigger
                                    scroll_images_tl = gsap.timeline({paused:true});
                                    scroll_images_tl.fromTo(image,{x:'-15vw'},{x:'0vw'})

                                    ScrollTrigger.create({
                                        containerAnimation: scroll_tl,
                                        animation: scroll_images_tl,
                                        trigger: image.closest('.mod-scroll__images'),
                                        start: "0% 78%",
                                        end: "90% 100%",
                                        scrub: .5,
                                        // toggleActions: 'play none none reverse',
                                        // markers: true,
                                    })

                                } 
                            })

                        }
                    } },'-=.5')
            }

            //anim rest elements
            scroll_intro_tl.from(document.querySelectorAll('.mod-scroll__intro__menu .menu-item'),
                {y:'2.5rem', duration: 1,  ease: 'power3.out', stagger: -.15, onStart: () => {
                    //set links before
                    setLink('.mod-scroll__intro__menu .menu-item')
                } },'-=1')
            scroll_intro_tl.from(document.querySelector('.mod-scroll__intro__section'),
                {opacity:0, duration: .5,  ease: 'linear' },'-=.5')
            scroll_intro_tl.from(document.querySelector('.mod-scroll__intro__copyright'),
                {opacity:0, duration: .5,  ease: 'linear' },'-=.5')


        }

        ////anima projects
        if(document.querySelectorAll('.mod-scroll__projects__item').length){


            if(!document.querySelector('.last-item')){
                const projects = document.querySelector('.mod-scroll__projects');
                gsap.set(projects,{width:''+sizeProjects+'vw'})
            }

            const projectsAll = document.querySelectorAll('.mod-scroll__projects__item')

            ///projects_tl to anim in desktop
            projects_tl = gsap.timeline({paused:true});

            ///anim each project
            projectsAll.forEach( (elem,index) => {

                ///anim text project
                const textTitle = elem.querySelector('.mod-scroll__projects__item__text__title');
                const dataTitle = elem.querySelectorAll('.mod-scroll__projects__item__text__data > div:not(.data-number)');
                const linkTitle = elem.querySelector('.mod-scroll__projects__item__text__data a.btn');
                const titleSplit = new SplitText(textTitle,{type: "chars,lines",})

                const textProject_tl = gsap.timeline({paused:true,delay:.1});
                textProject_tl.fromTo(dataTitle[0].querySelector('span'),{y:'100%'}, {y:'0%', duration: .33, ease: 'power2.out'},0)
                textProject_tl.fromTo(dataTitle[1].querySelector('span'),{y:'100%'}, {y:'0%', duration: .33, ease: 'power2.out'},.2)
                textProject_tl.fromTo(linkTitle,{y:'100%',opacity: 0}, {y:'0%',opacity: 1, duration: .33, ease: 'power2.out'},.4)
                textProject_tl.fromTo(titleSplit.chars,{y:'100%'}, {y:'0%', duration: .25, ease: 'power2.out', stagger: .05},.5)
                
                ///anim general project
                let time = index*1;
                const content = elem.querySelector('.mod-scroll__projects__item__content');
                const image = elem.querySelector('.mod-scroll__projects__item__image');
                const media = elem.querySelector('.media__source');

                
                if(!is_mobile){

                    ///show & hide textProject
                    projects_tl.to(elem,{opacity: 1, duration: .005, 
                        onComplete: () => { 
                            textProject_tl.pause(); textProject_tl.play() 
                        },
                        onReverseComplete: () => { 
                            textProject_tl.pause(); textProject_tl.timeScale(-2.5); 
                            textProject_tl.reverse() 
                        }
                    }
                    ,time+.5)

                    projects_tl.fromTo(elem,{ width:'15vw'},{ width:maxWidthItem+'vw', duration: 1, ease: 'power1.inOut(1)'},time)
                    projects_tl.fromTo(media,{ height:'87vh'},{ height:''+(heightItem*2)+'vh',  duration: 1, ease: 'power1.inOut(.1)'},time)

                }else{

                    const media_wrap = elem.querySelector('.media__wrap-source');

                     ///project_single_tl to anim in desktop
                    project_single_tl = gsap.timeline({paused:true});
                    project_single_tl.from(image, { height:'0svh', ease: 'power1.inOut(1)'} ,0)
                    project_single_tl.from(media_wrap, { height:'0svh', ease: 'power1.inOut(1)'} ,0)
                    project_single_tl.from(media, { scale:1.5, y:'-15%', ease: 'power1.inOut(1)' },0)

                    ScrollTrigger.create({
                        containerAnimation: scroll_tl,
                        animation: project_single_tl,
                        trigger: content,
                        start: "0% 90%",
                        end: "0% 25%",
                        scrub: .25,
                        onLeave: () => {
                            textProject_tl.pause(); textProject_tl.play()
                            if(triggerCierre) triggerCierre.refresh();
                            if(triggerFlipCierreImage) triggerFlipCierreImage.refresh();
                        },
                        onEnterBack: () => {
                            textProject_tl.pause(); textProject_tl.timeScale(-2); 
                            textProject_tl.reverse() 
                        },
                        // markers: true,
                    })
                }
                

            } )

            if(!is_mobile){
                triggerProjects = ScrollTrigger.create({
                    containerAnimation: scroll_tl,
                    animation: projects_tl,
                    trigger: projectsAll[0],
                    start: "0% 80%",
                    end: "+="+(maxWidthItem*projectsAll.length)+"%",
                    scrub: 0,
                    onLeave: () => {
                        if(triggerCierre) triggerCierre.refresh();
                        if(triggerFlipCierreImage) triggerFlipCierreImage.refresh();
                        if(triggerParallaxCierre) triggerParallaxCierre.refresh();
                    },
                    // markers: true,
                })
            }
            
        }

        ///anima last project
        if(document.querySelectorAll('.mod-scroll__projects__item.last-item').length){

            const lastProject = document.querySelector('.mod-scroll__projects__item.last-item');
            const lastProject_content = lastProject.querySelector('.mod-scroll__projects__item__content')
            const lastProject_carousel = lastProject.querySelector('.last-item__carousel')
            const lastProject_carouselContent = lastProject.querySelector('.last-item__content')
            const lastProject_carousel_items = lastProject.querySelectorAll('.last-item__carousel__item:not(.last-item__carousel__item--link)')
            const pin = document.querySelector('.mod-scroll__pin');
            const numItem = document.querySelectorAll('.last-item__carousel__item').length
            const widthPin = (numItem-1)*100;

            if(!is_mobile){

                ///set width pin depends num items
                gsap.set(pin,{width:''+widthPin+'vw'})

                lastProject_tl = gsap.timeline({paused:true});

                //set width lastproject to fix position project
                lastProject_tl.to(lastProject,{ x:''+( widthPin - adjust )+'vw', duration: 3, ease: 'none'},0)
                
                //rest of anim
                ///adjust width lastproject & lastProject_carouselContent
                lastProject_tl.fromTo(lastProject,{ width: maxWidthItem+'vw'},{ width: widthCarouselLast+'vw', duration: 1, ease: 'none'},0)
                lastProject_tl.fromTo(lastProject_carouselContent,{ width: (100-maxWidthItem)+'vw', x:maxWidthItem+'vw'},
                    { width: (100-widthCarouselLast)+'vw',x:widthCarouselLast+'vw', duration: 1, ease: 'none',
                        onStart: () => {
                            // lastProject_content_tl.play();
                        },
                        onReverseComplete: () => {
                            // lastProject_content_tl.reverse();
                        }
                    },0)    
                
                //move y carousel y lastProject_content --> para que queden la vision de las tres fotos
                lastProject_tl.fromTo(lastProject_carousel,{ y: '100vh'},
                    { y: ''+(100-(heightItem*(numItem-1)))+'vh', duration: 1, ease: 'none'},0)
                lastProject_tl.fromTo(lastProject_content,{ y: '0'},
                    { y: '-'+(heightItem*(numItem-2))+'vh', duration: 1, ease: 'none'},0)
                lastProject_tl.from(lastProject_carousel_items,{ height: '66vh', duration: 1, ease: 'none'},0)

                //move y carousel y lastProject_content 
                lastProject_tl.to(lastProject_carousel,{ y: '-'+(heightItem*(numItem-3))+'vh', duration: .75, ease: 'none'},1)
                lastProject_tl.to(lastProject_content,{ y: '-'+(heightItem*(numItem-1))+'vh', duration: .75, ease: 'none'},1)
                lastProject_tl.to(lastProject_carousel_items,{ height: '37.5vh', duration: .75, ease: 'power1.inOut',
                    onStart: () => {
                        lastProject_content_tl.play();
                        if(triggerCierre) triggerCierre.refresh();
                        if(triggerFlipCierreImage) triggerFlipCierreImage.refresh();
                        if(triggerParallaxCierre) triggerParallaxCierre.refresh();
                    },
                    onComplete: () => {
                        // lastProject_content_tl.play();
                    },
                    onReverseComplete: () => {
                        lastProject_content_tl.reverse();
                    }
                },1)

                triggerLastProject = ScrollTrigger.create({
                    containerAnimation: scroll_tl,
                    animation: lastProject_tl,
                    trigger: lastProject,
                    start: "left 0%",
                    end: "left -"+( widthPin - adjust )+"%",
                    scrub: 0,
                    onEnter: () => {
                        gsap.set(pin,{width:''+( widthPin - adjust )+'vw'})
                        if(triggerLastProject) triggerLastProject.refresh();

                        // scrollHTrigger.refresh();
                    },
                    onLeave: () => {
                        // if(triggerCierre) triggerCierre.refresh();
                        // if(triggerParallaxCierre) triggerParallaxCierre.refresh();
                        // scrollHTrigger.refresh();
                    },
                    // markers: true,
                })

            }else{
                
                lastProject_carousel_items.forEach( elem => {

                    lastProject_carousel_item_tl = gsap.timeline({paused:true});
                    // lastProject_carousel_item_tl.from(elem,{ height:'0', duration: 1, ease: 'power2.out'},0)
                    lastProject_carousel_item_tl.from(elem.querySelector('.image'),{ y:'-50%', scale:'1.1', duration: 1, ease: 'power1.out(.1)'})

                    ScrollTrigger.create({
                        containerAnimation: scroll_tl,
                        animation: lastProject_carousel_item_tl,
                        trigger: elem,
                        start: "0% bottom",
                        end: "100% bottom",
                        scrub: .25,
                        // markers: true,
                    })

                } )

                 ///lastProject_carouselContent_tl to anim in desktop
                

                // ScrollTrigger.create({
                //     containerAnimation: scroll_tl,
                //     animation: lastProject_carouselContent_tl,
                //     trigger: content,
                //     start: "0% bottom",
                //     end: "50% 65%",
                //     scrub: 0,
                //     onLeave: () => {
                //         textProject_tl.pause(); textProject_tl.play()
                //         if(triggerCierre) triggerCierre.refresh();
                //     },
                //     onEnterBack: () => {
                //         textProject_tl.pause(); textProject_tl.timeScale(-2); 
                //         textProject_tl.reverse() 
                //     },
                //     // markers: true,
                // })

            }
            

        }

        ///anima last slide
        if(document.querySelector('.mod-scroll__cierre') && !is_mobile){

            const cierre = document.querySelector('.mod-scroll__cierre');
            const cierreContent = document.querySelector('.mod-scroll__cierre__content');
            const cierreMedia = cierreContent.querySelector('.mod-scroll__cierre__content__image');
            const percentMov = (((cierre.offsetWidth - cierreContent.offsetWidth)*100)/window.innerWidth);

            const cierre_tl = gsap.timeline({paused:true});
            cierre_tl.fromTo(cierreContent,{x:'0%'},{x:percentMov+'%', ease:'none'},0)

            triggerCierre = ScrollTrigger.create({
                containerAnimation: scroll_tl,
                animation: cierre_tl,
                trigger: cierre,
                start: "left 0%",
                end: "left -"+percentMov+"%",
                scrub: 0,
                // markers: true,
            })

            const cierre_parallax_tl = gsap.timeline({paused:true});
            cierre_parallax_tl.from(cierreMedia.querySelectorAll(':scope > *'),{x:'-100%', ease:'none'},0)

            triggerParallaxCierre = ScrollTrigger.create({
                containerAnimation: scroll_tl,
                animation: cierre_parallax_tl,
                trigger: cierreContent,
                start: "left 100%",
                end: "left 0%",
                scrub: .1,
                // markers: true,
            })

        }

        ///SCROLL HORIZONTAL
        ///SCROLL HORIZONTAL
        ///SCROLL HORIZONTAL

        if(!is_mobile){

            sections = document.querySelectorAll('.mod-scroll > div');
            scrollH = document.querySelector('.mod-scroll');

            scroll_tl.progress(1)
            scrollH_width = scrollH.offsetWidth;
            scroll_tl.progress(0)

            let scroll_tl_end = ((scrollH_width*100)/window.innerWidth);
            const adjust_width = (document.querySelector('.mod-scroll__projects__item.last-item')) ? window.innerWidth*.2 : window.innerWidth*1.2 ;
            scroll_tl.to(sections, {x: (scrollH_width-adjust_width) * -1, duration:100, ease: "none"});
            let onlyOnceLeave = true;

            scrollHTrigger = ScrollTrigger.create({
                animation: scroll_tl,
                trigger: scrollH,
                pin: "main",
                scrub: 1,
                start: "top top",
                end: "+="+(scroll_tl_end)+"%",
                // markers: true,
                onEnter: () => {
                    if(control) console.log('----enter scroll');
                    
                    onScroll = true;
                    // scrollHTrigger.refresh();
                    if(triggerProjects) triggerProjects.refresh(); 
                    if(triggerLastProject) triggerLastProject.refresh(); 
                    // if(triggerCierre) triggerCierre.refresh();
                    // ScrollTrigger.refresh(); 
                },
                onLeave: () => {
                    onScroll = false;
                    if(onlyOnceLeave){
                        if(control) console.log('scroll leave');
                        onlyOnceLeave = false
                        last_animations();
                    }
                
                    // //get all scrolltrigger
                    // const allTriggers = ScrollTrigger.getAll()
                    // allTriggers.forEach(
                    //     elem => {   
                    //         //refresh only not have mod-scroll in trigger
                    //         if(elem.trigger){
                    //             const list = elem.trigger.classList.value.split(' ');
                    //             if(list.filter(el => el.includes('mod-scroll')).length == 0){
                    //                 elem.refresh();
                    //             }
                    //         }
                    //     }
                    // )
                    // ScrollTrigger.refresh(); 
                }
            })

        }
        
        
    }  
    
})
