'use strict';
var notify = $.notify('<img src="../assets/images/alert.png" alt=""><strong>Loading</strong> page Do not close this page...', {
    type: 'theme',
    allow_dismiss: true,
    delay: 2000,
    // showProgressbar: true,
    timer: 300
});

setTimeout(function() {
    notify.update('message', '<img src="../assets/images/alert.png" alt=""><strong>Loading</strong> Inner Data.');
}, 1000);
