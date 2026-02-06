// ============================================
// CONFIGURAÇÃO DO FIREBASE - VERSÃO MODULAR (v9+)
// ============================================

// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyC7BoZJoypnqLlEA4KyB6v2JE9CTc65AqM",
    authDomain: "controlefinanceiro-dd360.firebaseapp.com",
    projectId: "controlefinanceiro-dd360",
    storageBucket: "controlefinanceiro-dd360.firebasestorage.app",
    messagingSenderId: "363446721742",
    appId: "1:363446721742:web:b7b1be3edccdce07c1049f"
};

// Inicializar Firebase
let app = null;
let db = null;

try {
    // Verificar se Firebase já foi carregado
    if (typeof firebase !== 'undefined' && !firebase.apps.length) {
        app = firebase.initializeApp(firebaseConfig);
        console.log('✅ Firebase inicializado com sucesso!');
        
        // Inicializar Firestore
        db = firebase.firestore();
        console.log('✅ Firestore inicializado com sucesso!');
        
        // Configurar timestamps
        db.settings({
            timestampsInSnapshots: true
        });
        
        // Exportar db para uso global
        window.db = db;
    } else if (firebase.apps.length > 0) {
        // Firebase já inicializado
        app = firebase.apps[0];
        db = firebase.firestore();
        window.db = db;
        console.log('✅ Firebase já estava inicializado!');
    }
} catch (error) {
    console.error('❌ Erro ao inicializar Firebase:', error);
}

console.log('✅ Configuração Firebase carregada!');
