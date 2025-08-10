// Create a new file called transitions.js in your js folder
// Add this code:
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', function(e) {
            if (link.href && link.href.startsWith(window.location.origin)) {
                e.preventDefault();
                document.body.classList.add('fade-out');
                setTimeout(() => {
                    window.location.href = link.href;
                }, 300);
            }
        });
    });
});