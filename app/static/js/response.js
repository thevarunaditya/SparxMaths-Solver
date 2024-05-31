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
                            gallery.innerHTML = '';
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
                                        gallery.innerHTML = '';
                                        data.forEach(item => {
                                            var div = document.createElement('div');
                                            div.setAttribute('data-label', item.label);
                                            var img = document.createElement('img');
                                            img.src = `data:image/png;base64,${item.response}`;
                                            div.appendChild(img);
                                            gallery.appendChild(div);
                                        });
                                    };
                                };
                            });
                        };
                    };
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

document.querySelectorAll('.reload-icon').forEach(icon => {
    icon.addEventListener('click', async (event) => {
        const imgElement = event.currentTarget.closest('.answerimg-container').querySelector('img');
        const reloadIcon = event.currentTarget;
        const base64Img = imgElement.src.split(',')[1];
        const label = imgElement.getAttribute('data-label');

        reloadIcon.classList.add('loading');

        try {
            const response = await fetch('/reprocess', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64Img, label })
            });

            if (response.ok) {
                const result = await response.json();
                imgElement.src = `data:image/png;base64,${result.newImage}`;

                fetch('/previous-answers')
                    .then(response => response.json())
                    .then(data => {
                        gallery.innerHTML = '';
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
                                    gallery.innerHTML = '';
                                    data.forEach(item => {
                                        var div = document.createElement('div');
                                        div.setAttribute('data-label', item.label);
                                        var img = document.createElement('img');
                                        img.src = `data:image/png;base64,${item.response}`;
                                        div.appendChild(img);
                                        gallery.appendChild(div);
                                    });
                                };
                            };
                        });
                    });
            } else {
                console.error('Failed to reprocess image');
            }
        } catch (error) {
            console.error('Error during reprocessing:', error);
        } finally {
            reloadIcon.classList.remove('loading');
        }
    });
});