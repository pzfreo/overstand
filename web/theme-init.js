(function() {
    try {
        var t = localStorage.getItem('overstand-theme');
        if (t !== 'light') document.documentElement.setAttribute('data-theme', 'dark');
    } catch(e) {}
})();
