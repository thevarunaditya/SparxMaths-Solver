console.log('Script loaded');

var modal = document.getElementById("prev-answers-modal");
var btn = document.getElementById("prev-answers-btn");
var span = document.getElementById("close-modal");
var gallery = document.querySelector(".gallery");

btn.onclick = function() {
    modal.style.display = "block";
    fetch('/previous-answers')
        .then(response => response.json())
        .then(data => {
            gallery.innerHTML = '';
            if (data.length === 0) {
                gallery.innerHTML = '<p>No previous answers found.</p>';
            } else {
                data.forEach(item => {
                    var div = document.createElement('div');
                    div.setAttribute('data-label', item.label);
                    var img = document.createElement('img');
                    img.src = `data:image/png;base64,${item.response}`;
                    div.appendChild(img);
                    gallery.appendChild(div);

                    img.onclick = function() {
                        var enlarged = document.createElement('img');
                        enlarged.src = img.src;
                        enlarged.style.maxWidth = '100%';
                        enlarged.style.maxHeight = '80vh';
                        enlarged.style.border = '1px solid black';
                        enlarged.style.borderRadius = '5px';
                        enlarged.style.boxShadow = '5px 5px 0 #00000034';
                        gallery.innerHTML = '';
                        gallery.appendChild(enlarged);
                        enlarged.onclick = function() {
                        }
                    }
                });
            }
        })
        .catch(error => {
            console.error('Error fetching previous answers:', error);
            gallery.innerHTML = '<p>Error loading previous answers. Please try again later.</p>';
        });
};

span.onclick = function() {
    modal.style.display = "none";
}

window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
}