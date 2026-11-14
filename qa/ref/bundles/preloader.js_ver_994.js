
//first_charge
let first_charge = true;
(!localStorage.getItem('first_charge')) ? localStorage.setItem('first_charge', 1) : first_charge = false ;

document.addEventListener('DOMContentLoaded', () => {

    ///ANIM PRECHARGE
    ///ANIM PRECHARGE
    ///ANIM PRECHARGE
    let loaderAnim_end = false;

    //anima logo
    const split_normal = SplitText.create(header_logo_normal, {type: "chars,lines", charsClass: "char"})
    const split_is = SplitText.create('.header .logo__is', {type: "chars",charsClass: "char"})
    const split_boring = SplitText.create('.header .logo__boring', {type: "chars",charsClass: "char"})
    header_logo.querySelectorAll('.char').forEach(elem => {
        const content = elem.innerHTML;
        elem.innerHTML = '<span>'+content+'</span>';
    })
    const logo_tl = gsap.timeline({paused:true,onComplete:()=>{
        loaderAnim_end = true;
        if(control) console.log('loaderAnim_end: ',loaderAnim_end);
        if(fake_progress==100 && loaderAnim_end) loadComplete();
    }})
    logo_tl.from('.header .logo__normal span, .header .logo__is span, .header .logo__boring span',{x:'120%', duration: .5, stagger: 0.1, ease: 'power3.out'},0)
    // logo_tl.from(elem.querySelectorAll('.logo__boring span'),{x:'-120%', duration: .5, stagger: 0.1, ease: 'power3.out'}
          
    //if isset mods change color preloader
    if(document.querySelector('.mod-scroll__intro.bg-black') || document.querySelector('.mod-header--proyecto')){
        smoothWrapper.classList.add('bg-black')
    }
    //PRECHARGE
    //PRECHARGE
    //PRECHARGE
    let img = document.images, completed = 0, porcentLoad = 0, 
        totalImg = img.length, setFakeNumber = '', fake_progress = 0;
    // const loader = document.querySelector('.loader');
    const progress_bar = document.querySelector('.loader__progress');
    const progress_number = document.querySelector('.loader__percent');

    //if no isset images loadComplete()
    // if(totalImg == 0) return loadComplete();

    //on image is laoded
    const imgLoaded = () => {
        completed += 1;
        porcentLoad = ((100/totalImg*completed) << 0);
        // console.log('porcentLoad',porcentLoad);
    }

    ///loading all images
    for(var i=0; i<totalImg; i++) {
        var tImg     = new Image();
        tImg.onload  = imgLoaded;
        tImg.onerror = imgLoaded;
        tImg.src     = img[i].src;
    }

    ///set fake number
    setFakeNumber = setInterval(() => {

        if(first_charge){
            ///primera carga
            gsap.set('body',{opacity:1})
            if(logo_tl.progress()==0) setTimeout(() => { logo_tl.timeScale(timescale).play() }, 500);
            
            fake_progress++
            if(fake_progress > porcentLoad) fake_progress = porcentLoad;
            if(fake_progress > 100) fake_progress = 100;

            progress_bar.style = '--progress:'+fake_progress+'%'+'';
            const progress_width = progress_bar.getBoundingClientRect().width;
            const porcentLoadent = Math.trunc(( progress_width * 100) / window.innerWidth) + '%';
            if(porcentLoadent!='1%') progress_number.innerHTML = porcentLoadent;

            ///complete
            if(fake_progress==100 && setFakeNumber && loaderAnim_end) loadComplete(); 

        }else{
            ///cargas posteriores
            if(porcentLoad== 100) loadComplete();
        }

    }, 5);

    //loadComplete
    const loadComplete = () => {

        if(control) console.log('loadComplete');
        

        if(setFakeNumber!='') clearInterval(setFakeNumber) 
        if(first_charge){
            const porcentLoadent = '100%';
            progress_number.innerHTML = porcentLoadent;
            gsap.to(progress_bar,{ opacity:0, duration: .5,  ease: 'linear' })
            gsap.to(progress_number,{opacity:0, duration: .33, ease: 'linear'},'<')
            ///init
            setTimeout(() => {
                init()
            }, 1500);
        }else{
            gsap.set('body',{opacity:1})
            setTimeout(() => { logo_tl.progress(0).timeScale(timescale).play() }, 500);
            progress_bar.style.display = 'none';
            progress_number.style.display = 'none';
            ///init
            setTimeout(() => {
                logo_tl.progress(1)
                init()
            }, 3000/timescale);
        }
        
        
    }

        
    
})



