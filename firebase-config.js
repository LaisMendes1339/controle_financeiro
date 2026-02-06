// ============================================
// CONFIGURAÇÃO DO FIREBASE - VERSÃO 9.6.1 (MODULAR)
// ============================================

// Importações (não necessárias quando carregado via CDN)
const firebaseConfig = {
    apiKey: "AIzaSyD1WbnimImu-nncSzaW_CTbArUmhO_TRtQ",
    authDomain: "solicitacoes-cartograficas.firebaseapp.com",
    projectId: "solicitacoes-cartograficas",
    storageBucket: "solicitacoes-cartograficas.firebasestorage.app",
    messagingSenderId: "943123891027",
    appId: "1:943123891027:web:0ff0fdfefcbbfd3fe057a6",
    measurementId: "G-QF1K8QDXC5"
};

// Variável global para o app Firebase
let firebaseApp = null;
let db = null;

// Inicializar Firebase
try {
    // Verificar se Firebase já foi carregado
    if (typeof firebase !== 'undefined' && firebase.apps.length === 0) {
        firebaseApp = firebase.initializeApp(firebaseConfig);
        console.log('✅ Firebase inicializado com sucesso!');
        
        // Inicializar Firestore
        db = firebase.firestore();
        console.log('✅ Firestore inicializado com sucesso!');
        
        // Configurar timestamps para serem convertidos em objetos Date
        db.settings({
            timestampsInSnapshots: true
        });
    } else if (firebase.apps.length > 0) {
        // Firebase já inicializado
        firebaseApp = firebase.apps[0];
        db = firebase.firestore();
        console.log('✅ Firebase já estava inicializado!');
    }
} catch (error) {
    console.error('❌ Erro ao inicializar Firebase:', error);
}

// Exportar db para uso global
window.db = db;

console.log('✅ Configuração Firebase carregada!');
