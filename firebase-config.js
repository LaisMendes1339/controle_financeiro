// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyD1WbnimImu-nncSzaW_CTbArUmhO_TRtQ",
    authDomain: "solicitacoes-cartograficas.firebaseapp.com",
    databaseURL: "https://solicitacoes-cartograficas-default-rtdb.firebaseio.com",
    projectId: "solicitacoes-cartograficas",
    storageBucket: "solicitacoes-cartograficas.firebasestorage.app",
    messagingSenderId: "943123891027",
    appId: "1:943123891027:web:0ff0fdfefcbbfd3fe057a6",
    measurementId: "G-QF1K8QDXC5"
};

// Inicializar Firebase apenas se estiver disponível
if (typeof firebase !== 'undefined') {
    try {
        firebase.initializeApp(firebaseConfig);
        console.log('✅ Firebase inicializado com sucesso!');
    } catch (error) {
        console.log('ℹ️ Firebase não inicializado (opcional para demonstração)');
    }
}