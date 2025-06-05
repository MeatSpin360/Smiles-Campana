(function ($) {

  "use strict";

    // PRE LOADER
    $(window).load(function(){
      $('.preloader').fadeOut(1000); // set duration in brackets    
    });


    //Navigation Section
    $('.navbar-collapse a').on('click',function(){
      $(".navbar-collapse").collapse('hide');
    });


    // Owl Carousel
    $('.owl-carousel').owlCarousel({
      animateOut: 'fadeOut',
      items:1,
      loop:true,
      autoplay:true,
    })


    // PARALLAX EFFECT
    $.stellar();  


    // SMOOTHSCROLL
    $(function() {
      $('.navbar-default a, #home a, footer a').on('click', function(event) {
        var $anchor = $(this);
        var href = $anchor.attr('href');
        // Solo aplica smooth scroll si el href es un id existente en la página
        if (href && href.startsWith('#') && $(href).length) {
          $('html, body').stop().animate({
            scrollTop: $(href).offset().top - 49
          }, 1000);
          event.preventDefault();
        }
        // Si no, deja el comportamiento por defecto (por ejemplo, links externos o a otras páginas)
      });
    });  
    
    // WOW ANIMATION
    new WOW({ mobile: false }).init();

})(jQuery);
