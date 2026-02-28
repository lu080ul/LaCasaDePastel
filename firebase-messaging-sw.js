importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyCy3LJvSpLChOhZcywd6k490p8eqdze3Tk",
    authDomain: "la-casa-de-pastel-34cf3.firebaseapp.com",
    projectId: "la-casa-de-pastel-34cf3",
    storageBucket: "la-casa-de-pastel-34cf3.firebasestorage.app",
    messagingSenderId: "1072801934019",
    appId: "1:1072801934019:web:c181746ad42ba4ba45d076",
    measurementId: "G-3KV7DSJME9"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Recebido payload em background:', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/cliente/icon-192.png' // Use you own icon later
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
