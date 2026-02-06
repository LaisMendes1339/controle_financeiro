// ============================================
// VARIÁVEIS GLOBAIS
// ============================================
let db = null;
let customers = [];
let loans = [];
let payments = [];
let currentPayment = null;
let confirmCallback = null;
let statusCallback = null;
let statusData = null;
let unsubscribeCustomers = null;
let unsubscribeLoans = null;
let unsubscribePayments = null;

// Inicializar jsPDF
const { jsPDF } = window.jspdf;

// ============================================
// INICIALIZAÇÃO DO SISTEMA
// ============================================
document.addEventListener('DOMContentLoaded', async function() {
    console.log('✅ Sistema LuCred iniciando...');
    
    try {
        // Aguardar Firebase carregar
        await waitForFirebase();
        
        // Inicializar sistema
        await initSystem();
        
        console.log('✅ LuCred carregado com sucesso!');
    } catch (error) {
        console.error('❌ Erro na inicialização:', error);
        showNotification('❌ Erro ao inicializar o sistema!', 'error');
    }
});

async function waitForFirebase() {
    return new Promise((resolve, reject) => {
        const checkFirebase = setInterval(() => {
            if (typeof firebase !== 'undefined' && window.db) {
                db = window.db;
                clearInterval(checkFirebase);
                resolve();
            }
        }, 100);
        
        setTimeout(() => {
            clearInterval(checkFirebase);
            reject(new Error('Firebase não carregado'));
        }, 5000);
    });
}

// ============================================
// INICIALIZAÇÃO DO SISTEMA
// ============================================
async function initSystem() {
    // Inicializar gráfico
    initRevenueChart();
    
    // Configurar listeners
    setupEventListeners();
    
    // Setar data atual
    const today = new Date().toISOString().split('T')[0];
    const startDate = document.getElementById('loanStartDate');
    const paymentDate = document.getElementById('paymentDate');
    if (startDate) startDate.value = today;
    if (paymentDate) paymentDate.value = today;
    
    // Configurar listeners em tempo real do Firebase
    await setupFirebaseListeners();
}

// ============================================
// CONFIGURAÇÃO DOS LISTENERS DO FIREBASE
// ============================================
async function setupFirebaseListeners() {
    if (!db) {
        console.error('❌ Firestore não inicializado!');
        return;
    }
    
    try {
        // Listener para clientes - sincronização em tempo real
        unsubscribeCustomers = db.collection('customers')
            .onSnapshot(snapshot => {
                customers = [];
                snapshot.forEach(doc => {
                    customers.push({ id: doc.id, ...doc.data() });
                });
                renderCustomersTable();
                loadCustomersInSelect();
                updateDashboard();
                console.log('✅ Clientes sincronizados:', customers.length);
            }, error => {
                console.error('❌ Erro ao carregar clientes:', error);
                showNotification('❌ Erro ao carregar clientes!', 'error');
            });
        
        // Listener para empréstimos - sincronização em tempo real
        unsubscribeLoans = db.collection('loans')
            .onSnapshot(snapshot => {
                loans = [];
                snapshot.forEach(doc => {
                    loans.push({ id: doc.id, ...doc.data() });
                });
                renderLoansTable();
                updateDashboard();
                console.log('✅ Empréstimos sincronizados:', loans.length);
            }, error => {
                console.error('❌ Erro ao carregar empréstimos:', error);
                showNotification('❌ Erro ao carregar empréstimos!', 'error');
            });
        
        // Listener para pagamentos - sincronização em tempo real
        unsubscribePayments = db.collection('payments')
            .onSnapshot(snapshot => {
                payments = [];
                snapshot.forEach(doc => {
                    payments.push({ id: doc.id, ...doc.data() });
                });
                renderPaymentsTable();
                updateDashboard();
                updateReports();
                console.log('✅ Pagamentos sincronizados:', payments.length);
            }, error => {
                console.error('❌ Erro ao carregar pagamentos:', error);
                showNotification('❌ Erro ao carregar pagamentos!', 'error');
            });
    } catch (error) {
        console.error('❌ Erro ao configurar listeners:', error);
    }
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
    // Tabs navigation
    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            switchTab(tabId);
        });
    });
    
    // Period selector
    document.querySelectorAll('.period-btn').forEach(button => {
        button.addEventListener('click', function() {
            document.querySelectorAll('.period-btn').forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            const period = this.getAttribute('data-period');
            updateChartPeriod(period);
        });
    });
    
    // Form listeners
    const loanForm = document.getElementById('loanForm');
    const customerForm = document.getElementById('customerForm');
    const paymentForm = document.getElementById('paymentForm');
    
    if (loanForm) {
        loanForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveLoan();
        });
    }
    
    if (customerForm) {
        customerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveCustomer();
        });
    }
    
    if (paymentForm) {
        paymentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            savePayment();
        });
    }
    
    // Input listeners for calculations
    const paymentAmount = document.getElementById('paymentAmount');
    const paymentLateFee = document.getElementById('paymentLateFee');
    
    if (paymentAmount) {
        paymentAmount.addEventListener('input', updatePaymentSummary);
    }
    
    if (paymentLateFee) {
        paymentLateFee.addEventListener('input', updatePaymentSummary);
    }
    
    // Fechar modais ao clicar fora
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            const modalId = event.target.id;
            closeModal(modalId);
        }
    };
    
    // Relatório period change
    const reportPeriod = document.getElementById('reportPeriod');
    if (reportPeriod) {
        reportPeriod.addEventListener('change', updateReports);
    }
}

// ============================================
// TABS NAVIGATION
// ============================================
function switchTab(tabId) {
    // Hide all tabs
    document.querySelectorAll('.tab-pane').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Deactivate all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    const tabElement = document.getElementById(tabId + '-tab');
    if (tabElement) {
        tabElement.classList.add('active');
    }
    
    // Activate selected button
    const button = document.querySelector(`[data-tab="${tabId}"]`);
    if (button) {
        button.classList.add('active');
    }
    
    // Scroll to content
    const tabContent = document.querySelector('.tabs-content');
    if (tabContent) {
        tabContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    // Update data if needed
    if (tabId === 'dashboard') {
        updateDashboard();
    } else if (tabId === 'reports') {
        updateReports();
    } else if (tabId === 'customers') {
        renderCustomersTable();
    } else if (tabId === 'loans') {
        renderLoansTable();
    } else if (tabId === 'payments') {
        renderPaymentsTable();
    }
}

// ============================================
// GRÁFICO DE RECEITA
// ============================================
let revenueChart;

function initRevenueChart() {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;
    
    const chartCtx = ctx.getContext('2d');
    
    const data = {
        labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
        datasets: [{
            label: 'Receita Mensal (R$)',
             [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            borderColor: '#4F46E5',
            backgroundColor: 'rgba(79, 70, 229, 0.1)',
            borderWidth: 3,
            pointBackgroundColor: '#4F46E5',
            pointRadius: 5,
            pointHoverRadius: 8,
            fill: true,
            tension: 0.4
        }]
    };
    
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                backgroundColor: '#1F2937',
                titleColor: '#FFFFFF',
                bodyColor: '#FFFFFF',
                borderColor: '#4F46E5',
                borderWidth: 1,
                padding: 12,
                displayColors: false
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)'
                },
                ticks: {
                    callback: function(value) {
                        return 'R$ ' + value.toLocaleString('pt-BR');
                    }
                }
            },
            x: {
                grid: {
                    display: false
                }
            }
        }
    };
    
    revenueChart = new Chart(chartCtx, {
        type: 'line',
         data,
        options: options
    });
}

function updateChartPeriod(period) {
    let newData;
    
    switch(period) {
        case 'week':
            newData = [0, 0, 0, 0, 0, 0, 0];
            revenueChart.data.labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
            break;
        case 'month':
            newData = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            revenueChart.data.labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            break;
        case 'year':
            newData = [0, 0, 0, 0];
            revenueChart.data.labels = ['2023', '2024', '2025', '2026'];
            break;
    }
    
    revenueChart.data.datasets[0].data = newData;
    revenueChart.update();
}

// ============================================
// CÁLCULOS FINANCEIROS
// ============================================
function calculateCompoundInterest(principal, rate, periods) {
    const rateDecimal = rate / 100;
    
    // Fórmula Price: P = C × [i(1+i)^n] / [(1+i)^n - 1]
    const monthlyPayment = principal * (rateDecimal * Math.pow(1 + rateDecimal, periods)) / 
                          (Math.pow(1 + rateDecimal, periods) - 1);
    
    const totalAmount = monthlyPayment * periods;
    const totalInterest = totalAmount - principal;
    
    return {
        totalAmount,
        totalInterest,
        monthlyPayment,
        profit: totalInterest
    };
}

function updateCalculationPreview() {
    const principal = parseFloat(document.getElementById('loanPrincipal').value) || 0;
    const rate = parseFloat(document.getElementById('loanInterestRate').value) || 0;
    const periods = parseInt(document.getElementById('loanInstallments').value) || 1;
    
    if (principal > 0 && rate > 0 && periods > 0) {
        const result = calculateCompoundInterest(principal, rate, periods);
        
        document.getElementById('calcMonthlyPayment').textContent = 
            formatCurrency(result.monthlyPayment);
        document.getElementById('calcTotalAmount').textContent = 
            formatCurrency(result.totalAmount);
        document.getElementById('calcTotalInterest').textContent = 
            formatCurrency(result.totalInterest);
        document.getElementById('calcProfit').textContent = 
            formatCurrency(result.profit);
    }
}

// ============================================
// FORMATAÇÃO
// ============================================
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function formatDate(date) {
    if (!date) return '-';
    if (typeof date === 'string') {
        return new Date(date).toLocaleDateString('pt-BR');
    }
    return date.toLocaleDateString('pt-BR');
}

function formatCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

// ============================================
// MODALS
// ============================================
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Resetar formulários
    if (modalId === 'customerModal') {
        document.getElementById('customerForm').reset();
        document.getElementById('customerId').value = '';
        document.getElementById('customerModalTitle').textContent = 'Novo Cliente';
        document.getElementById('customerSaveBtnText').textContent = 'Salvar Cliente';
    } else if (modalId === 'loanModal') {
        document.getElementById('loanForm').reset();
        document.getElementById('loanId').value = '';
        document.getElementById('loanModalTitle').textContent = 'Novo Empréstimo / Venda';
        document.getElementById('loanSaveBtnText').textContent = 'Salvar Empréstimo';
        document.getElementById('vehicleFields').style.display = 'none';
        loadCustomersInSelect();
    } else if (modalId === 'paymentModal') {
        document.getElementById('paymentForm').reset();
        currentPayment = null;
    }
}

// ============================================
// CLIENTES - CRUD COM FIREBASE
// ============================================
function showCustomerModal(customer = null) {
    if (customer) {
        document.getElementById('customerId').value = customer.id;
        document.getElementById('customerName').value = customer.name;
        document.getElementById('customerPhone').value = customer.phone;
        document.getElementById('customerEmail').value = customer.email || '';
        document.getElementById('customerCPF').value = customer.cpf;
        document.getElementById('customerAddress').value = customer.address || '';
        document.getElementById('customerModalTitle').textContent = 'Editar Cliente';
        document.getElementById('customerSaveBtnText').textContent = 'Atualizar Cliente';
    } else {
        document.getElementById('customerForm').reset();
        document.getElementById('customerId').value = '';
        document.getElementById('customerModalTitle').textContent = 'Novo Cliente';
        document.getElementById('customerSaveBtnText').textContent = 'Salvar Cliente';
    }
    
    showModal('customerModal');
}

async function saveCustomer() {
    const customerId = document.getElementById('customerId').value;
    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    const email = document.getElementById('customerEmail').value.trim();
    const cpf = document.getElementById('customerCPF').value.trim();
    const address = document.getElementById('customerAddress').value.trim();
    
    if (!name || !phone || !cpf) {
        showNotification('❌ Preencha todos os campos obrigatórios!', 'error');
        return;
    }
    
    const customerData = {
        name: name,
        phone: phone,
        email: email,
        cpf: cpf,
        address: address,
        status: 'active',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        showNotification('⏳ Salvando cliente...', 'info');
        
        if (customerId) {
            // Atualizar cliente existente
            await db.collection('customers').doc(customerId).update(customerData);
            showNotification('✅ Cliente atualizado com sucesso!', 'success');
        } else {
            // Criar novo cliente
            const docRef = await db.collection('customers').add(customerData);
            showNotification('✅ Cliente cadastrado com sucesso!', 'success');
        }
        
        closeModal('customerModal');
    } catch (error) {
        console.error('❌ Erro ao salvar cliente:', error);
        showNotification('❌ Erro ao salvar cliente!', 'error');
    }
}

async function deleteCustomer(id) {
    confirmAction(
        'Excluir Cliente',
        'Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.',
        async function() {
            try {
                // Verificar se o cliente tem empréstimos
                const loansSnapshot = await db.collection('loans')
                    .where('customerId', '==', id)
                    .get();
                
                if (!loansSnapshot.empty) {
                    showNotification('⚠️ Cliente possui empréstimos ativos. Exclua os empréstimos primeiro.', 'error');
                    return;
                }
                
                // Excluir cliente
                await db.collection('customers').doc(id).delete();
                showNotification('✅ Cliente excluído com sucesso!', 'success');
            } catch (error) {
                console.error('❌ Erro ao excluir cliente:', error);
                showNotification('❌ Erro ao excluir cliente!', 'error');
            }
        }
    );
}

// ============================================
// EMPRÉSTIMOS - CRUD COM FIREBASE
// ============================================
function loadCustomersInSelect() {
    const select = document.getElementById('loanCustomer');
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecione um cliente</option>';
    
    customers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.id;
        option.textContent = customer.name;
        select.appendChild(option);
    });
}

function toggleVehicleFields() {
    const loanType = document.getElementById('loanType').value;
    const vehicleFields = document.getElementById('vehicleFields');
    
    if (vehicleFields) {
        if (loanType === 'vehicle') {
            vehicleFields.style.display = 'block';
        } else {
            vehicleFields.style.display = 'none';
        }
    }
}

function showLoanModal(loan = null) {
    loadCustomersInSelect();
    
    if (loan) {
        document.getElementById('loanId').value = loan.id;
        document.getElementById('loanCustomer').value = loan.customerId;
        document.getElementById('loanType').value = loan.type || 'loan';
        document.getElementById('loanPrincipal').value = loan.principal;
        document.getElementById('loanInterestRate').value = loan.interestRate;
        document.getElementById('loanInstallments').value = loan.installments;
        document.getElementById('loanStartDate').value = loan.startDate.split('T')[0];
        document.getElementById('loanModalTitle').textContent = 'Editar Empréstimo';
        document.getElementById('loanSaveBtnText').textContent = 'Atualizar Empréstimo';
        
        if (loan.type === 'vehicle') {
            document.getElementById('vehicleModel').value = loan.vehicleModel || '';
            document.getElementById('vehicleYear').value = loan.vehicleYear || '';
            document.getElementById('vehiclePlate').value = loan.vehiclePlate || '';
            document.getElementById('vehicleChassis').value = loan.vehicleChassis || '';
            document.getElementById('vehicleFields').style.display = 'block';
        } else {
            document.getElementById('vehicleFields').style.display = 'none';
        }
        
        updateCalculationPreview();
    } else {
        document.getElementById('loanForm').reset();
        document.getElementById('loanId').value = '';
        document.getElementById('loanModalTitle').textContent = 'Novo Empréstimo / Venda';
        document.getElementById('loanSaveBtnText').textContent = 'Salvar Empréstimo';
        document.getElementById('vehicleFields').style.display = 'none';
    }
    
    showModal('loanModal');
}

async function saveLoan() {
    const loanId = document.getElementById('loanId').value;
    const customerId = document.getElementById('loanCustomer').value;
    const type = document.getElementById('loanType').value;
    const principal = parseFloat(document.getElementById('loanPrincipal').value);
    const interestRate = parseFloat(document.getElementById('loanInterestRate').value);
    const installments = parseInt(document.getElementById('loanInstallments').value);
    const startDate = document.getElementById('loanStartDate').value;
    
    if (!customerId || !principal || !interestRate || !installments || !startDate) {
        showNotification('❌ Preencha todos os campos obrigatórios!', 'error');
        return;
    }
    
    const customer = customers.find(c => c.id === customerId);
    if (!customer) {
        showNotification('❌ Cliente não encontrado!', 'error');
        return;
    }
    
    const calculation = calculateCompoundInterest(principal, interestRate, installments);
    
    const loanData = {
        customerId: customerId,
        customerName: customer.name,
        type: type,
        principal: principal,
        interestRate: interestRate,
        installments: installments,
        startDate: startDate,
        totalAmount: calculation.totalAmount,
        totalInterest: calculation.totalInterest,
        monthlyPayment: calculation.monthlyPayment,
        profit: calculation.profit,
        status: 'active',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    if (type === 'vehicle') {
        loanData.vehicleModel = document.getElementById('vehicleModel').value;
        loanData.vehicleYear = document.getElementById('vehicleYear').value;
        loanData.vehiclePlate = document.getElementById('vehiclePlate').value;
        loanData.vehicleChassis = document.getElementById('vehicleChassis').value;
    }
    
    try {
        showNotification('⏳ Salvando empréstimo...', 'info');
        
        if (loanId) {
            // Atualizar empréstimo existente
            await db.collection('loans').doc(loanId).update(loanData);
            
            // Excluir pagamentos antigos e criar novos
            const paymentsSnapshot = await db.collection('payments')
                .where('loanId', '==', loanId)
                .get();
            
            const batch = db.batch();
            paymentsSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            
            await createInstallments(loanData, loanId);
            showNotification('✅ Empréstimo atualizado com sucesso!', 'success');
        } else {
            // Criar novo empréstimo
            const docRef = await db.collection('loans').add(loanData);
            await createInstallments(loanData, docRef.id);
            showNotification('✅ Empréstimo cadastrado com sucesso!', 'success');
        }
        
        closeModal('loanModal');
    } catch (error) {
        console.error('❌ Erro ao salvar empréstimo:', error);
        showNotification('❌ Erro ao salvar empréstimo!', 'error');
    }
}

async function deleteLoan(id) {
    confirmAction(
        'Excluir Empréstimo',
        'Tem certeza que deseja excluir este empréstimo? Todas as parcelas associadas serão removidas.',
        async function() {
            try {
                // Excluir pagamentos associados
                const paymentsSnapshot = await db.collection('payments')
                    .where('loanId', '==', id)
                    .get();
                
                const batch = db.batch();
                paymentsSnapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
                
                // Excluir empréstimo
                await db.collection('loans').doc(id).delete();
                showNotification('✅ Empréstimo excluído com sucesso!', 'success');
            } catch (error) {
                console.error('❌ Erro ao excluir empréstimo:', error);
                showNotification('❌ Erro ao excluir empréstimo!', 'error');
            }
        }
    );
}

async function createInstallments(loanData, loanId) {
    const startDate = new Date(loanData.startDate);
    
    for (let i = 1; i <= loanData.installments; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        
        const paymentData = {
            loanId: loanId,
            customerId: loanData.customerId,
            customerName: loanData.customerName,
            installmentNumber: i,
            dueDate: dueDate.toISOString(),
            amount: loanData.monthlyPayment,
            lateFee: 0,
            paidAmount: 0,
            status: 'pending',
            paymentDate: null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('payments').add(paymentData);
    }
}

// ============================================
// PAGAMENTOS - CRUD COM FIREBASE
// ============================================
function showPaymentModal(payment = null) {
    if (!payment) {
        showNotification('❌ Selecione um pagamento para registrar!', 'error');
        return;
    }
    
    currentPayment = payment;
    
    // Preencher informações do pagamento
    const paymentInfo = document.getElementById('paymentInfo');
    if (paymentInfo) {
        paymentInfo.innerHTML = `
            <p><strong>Cliente:</strong> ${payment.customerName}</p>
            <p><strong>Parcela:</strong> ${payment.installmentNumber}/${payment.installmentNumber}</p>
            <p><strong>Vencimento:</strong> ${formatDate(payment.dueDate)}</p>
            <p><strong>Valor Original:</strong> ${formatCurrency(payment.amount)}</p>
        `;
    }
    
    // Preencher campos do formulário
    document.getElementById('paymentId').value = payment.id;
    document.getElementById('paymentLoanId').value = payment.loanId;
    document.getElementById('paymentInstallmentNumber').value = payment.installmentNumber;
    document.getElementById('paymentAmount').value = payment.amount.toFixed(2);
    document.getElementById('paymentLateFee').value = '0.00';
    
    // Atualizar resumo
    updatePaymentSummary();
    
    showModal('paymentModal');
}

function updatePaymentSummary() {
    const paymentAmount = parseFloat(document.getElementById('paymentAmount').value) || 0;
    const lateFee = parseFloat(document.getElementById('paymentLateFee').value) || 0;
    
    const total = paymentAmount + lateFee;
    
    document.getElementById('summaryOriginalAmount').textContent = formatCurrency(paymentAmount);
    document.getElementById('summaryLateFee').textContent = formatCurrency(lateFee);
    document.getElementById('summaryTotal').textContent = formatCurrency(total);
}

async function savePayment() {
    const paymentId = document.getElementById('paymentId').value;
    const paymentAmount = parseFloat(document.getElementById('paymentAmount').value);
    const lateFee = parseFloat(document.getElementById('paymentLateFee').value) || 0;
    const paymentDate = document.getElementById('paymentDate').value;
    
    if (!paymentId || !paymentAmount || !paymentDate) {
        showNotification('❌ Preencha todos os campos obrigatórios!', 'error');
        return;
    }
    
    const paymentData = {
        status: 'paid',
        paidAmount: paymentAmount,
        lateFee: lateFee,
        paymentDate: paymentDate,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        await db.collection('payments').doc(paymentId).update(paymentData);
        showNotification('✅ Pagamento registrado com sucesso!', 'success');
        closeModal('paymentModal');
    } catch (error) {
        console.error('❌ Erro ao registrar pagamento:', error);
        showNotification('❌ Erro ao registrar pagamento!', 'error');
    }
}

async function markPaymentAsPaid(paymentId) {
    confirmAction(
        'Confirmar Pagamento',
        'Deseja marcar este pagamento como pago?',
        async function() {
            const today = new Date().toISOString().split('T')[0];
            
            const paymentData = {
                status: 'paid',
                paidAmount: payments.find(p => p.id === paymentId).amount,
                paymentDate: today,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            try {
                await db.collection('payments').doc(paymentId).update(paymentData);
                showNotification('✅ Pagamento confirmado!', 'success');
            } catch (error) {
                console.error('❌ Erro ao confirmar pagamento:', error);
                showNotification('❌ Erro ao confirmar pagamento!', 'error');
            }
        }
    );
}

async function editPayment(payment) {
    showPaymentModal(payment);
}

async function deletePayment(id) {
    confirmAction(
        'Excluir Pagamento',
        'Tem certeza que deseja excluir este pagamento?',
        async function() {
            try {
                await db.collection('payments').doc(id).delete();
                showNotification('✅ Pagamento excluído com sucesso!', 'success');
            } catch (error) {
                console.error('❌ Erro ao excluir pagamento:', error);
                showNotification('❌ Erro ao excluir pagamento!', 'error');
            }
        }
    );
}

// ============================================
// RENDERIZAÇÃO DAS TABELAS
// ============================================
function renderCustomersTable() {
    const tbody = document.getElementById('customersTable');
    const noData = document.getElementById('noCustomers');
    
    if (!tbody || !noData) return;
    
    if (customers.length === 0) {
        tbody.innerHTML = '';
        noData.style.display = 'block';
        return;
    }
    
    noData.style.display = 'none';
    tbody.innerHTML = '';
    
    customers.forEach(customer => {
        const loanCount = loans.filter(l => l.customerId === customer.id).length;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><i class="fas fa-user"></i> ${customer.name}</td>
            <td>${customer.phone}</td>
            <td>${customer.email || '-'}</td>
            <td>${formatCPF(customer.cpf)}</td>
            <td>${loanCount}</td>
            <td><span class="status-badge status-active">Ativo</span></td>
            <td>
                <button class="btn-icon btn-warning" title="Editar" onclick="showCustomerModal(${escapeHtml(JSON.stringify(customer))})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon btn-danger" title="Excluir" onclick="deleteCustomer('${customer.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function renderLoansTable() {
    const tbody = document.getElementById('loansTable');
    const noData = document.getElementById('noLoans');
    
    if (!tbody || !noData) return;
    
    if (loans.length === 0) {
        tbody.innerHTML = '';
        noData.style.display = 'block';
        return;
    }
    
    noData.style.display = 'none';
    tbody.innerHTML = '';
    
    loans.forEach(loan => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><i class="fas fa-user"></i> ${loan.customerName}</td>
            <td>${loan.type === 'loan' ? 'Empréstimo' : 'Veículo'}</td>
            <td class="amount">${formatCurrency(loan.principal)}</td>
            <td>${loan.interestRate}% a.m.</td>
            <td>${loan.installments}x</td>
            <td class="amount">${formatCurrency(loan.totalAmount)}</td>
            <td class="amount">${formatCurrency(loan.totalInterest)}</td>
            <td class="amount profit">${formatCurrency(loan.profit)}</td>
            <td><span class="status-badge status-active">Ativo</span></td>
            <td>
                <button class="btn-icon btn-warning" title="Editar" onclick="showLoanModal(${escapeHtml(JSON.stringify(loan))})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon btn-danger" title="Excluir" onclick="deleteLoan('${loan.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function renderPaymentsTable() {
    const tbody = document.getElementById('paymentsTable');
    const noData = document.getElementById('noPayments');
    
    if (!tbody || !noData) return;
    
    // Filtro de status
    const statusFilter = document.getElementById('paymentStatusFilter')?.value || 'all';
    const dateFilter = document.getElementById('paymentDateFilter')?.value || '';
    
    let filteredPayments = [...payments];
    
    if (statusFilter !== 'all') {
        filteredPayments = filteredPayments.filter(p => p.status === statusFilter);
    }
    
    if (dateFilter) {
        filteredPayments = filteredPayments.filter(p => {
            const dueDate = new Date(p.dueDate).toISOString().split('T')[0];
            return dueDate === dateFilter;
        });
    }
    
    if (filteredPayments.length === 0) {
        tbody.innerHTML = '';
        noData.style.display = 'block';
        return;
    }
    
    noData.style.display = 'none';
    tbody.innerHTML = '';
    
    filteredPayments.forEach(payment => {
        const row = document.createElement('tr');
        
        let statusBadge = '';
        let actionBtn = '';
        
        if (payment.status === 'pending') {
            statusBadge = '<span class="status-badge status-pending">Pendente</span>';
            actionBtn = `
                <button class="btn-icon btn-success" title="Registrar Pagamento" onclick="showPaymentModal(${escapeHtml(JSON.stringify(payment))})">
                    <i class="fas fa-money-bill-wave"></i>
                </button>
                <button class="btn-icon btn-warning" title="Editar" onclick="editPayment(${escapeHtml(JSON.stringify(payment))})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon btn-danger" title="Excluir" onclick="deletePayment('${payment.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            `;
        } else if (payment.status === 'paid') {
            statusBadge = '<span class="status-badge status-paid">Pago</span>';
            actionBtn = `
                <button class="btn-icon btn-warning" title="Editar" onclick="editPayment(${escapeHtml(JSON.stringify(payment))})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon btn-danger" title="Excluir" onclick="deletePayment('${payment.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            `;
        } else if (payment.status === 'overdue') {
            statusBadge = '<span class="status-badge status-overdue">Atrasado</span>';
            actionBtn = `
                <button class="btn-icon btn-success" title="Registrar Pagamento" onclick="showPaymentModal(${escapeHtml(JSON.stringify(payment))})">
                    <i class="fas fa-money-bill-wave"></i>
                </button>
                <button class="btn-icon btn-warning" title="Editar" onclick="editPayment(${escapeHtml(JSON.stringify(payment))})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon btn-danger" title="Excluir" onclick="deletePayment('${payment.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            `;
        }
        
        row.innerHTML = `
            <td><i class="fas fa-user"></i> ${payment.customerName}</td>
            <td>${payment.installmentNumber}</td>
            <td>${formatDate(payment.dueDate)}</td>
            <td class="amount">${formatCurrency(payment.amount)}</td>
            <td>${statusBadge}</td>
            <td>${payment.paymentDate ? formatDate(payment.paymentDate) : '-'}</td>
            <td>${actionBtn}</td>
        `;
        tbody.appendChild(row);
    });
}

// ============================================
// DASHBOARD
// ============================================
function renderClientRanking() {
    const container = document.getElementById('clientRanking');
    const noClients = document.getElementById('noClients');
    
    if (!container || !noClients) return;
    
    if (customers.length === 0) {
        container.innerHTML = '';
        noClients.style.display = 'block';
        return;
    }
    
    noClients.style.display = 'none';
    
    // Ordenar clientes por número de empréstimos
    const customersWithLoans = customers.map(customer => {
        const customerLoans = loans.filter(l => l.customerId === customer.id);
        const totalLoaned = customerLoans.reduce((sum, l) => sum + l.principal, 0);
        return {
            ...customer,
            loanCount: customerLoans.length,
            totalLoaned: totalLoaned
        };
    }).sort((a, b) => b.loanCount - a.loanCount);
    
    container.innerHTML = '';
    
    customersWithLoans.slice(0, 5).forEach((customer, index) => {
        const item = document.createElement('div');
        item.className = 'ranking-item';
        item.innerHTML = `
            <div class="ranking-info">
                <div class="ranking-avatar">${index + 1}</div>
                <div>
                    <h4>${customer.name}</h4>
                    <div class="ranking-detail">
                        <i class="fas fa-file-invoice-dollar"></i> ${customer.loanCount} empréstimos
                    </div>
                    <div class="ranking-detail">
                        <i class="fas fa-dollar-sign"></i> Total: ${formatCurrency(customer.totalLoaned)}
                    </div>
                </div>
            </div>
            <div class="ranking-value">
                <span class="badge-success">${customer.loanCount} empréstimos</span>
            </div>
        `;
        container.appendChild(item);
    });
}

function renderUpcomingPayments() {
    const tbody = document.getElementById('upcomingPaymentsTable');
    const noData = document.getElementById('noUpcomingPayments');
    
    if (!tbody || !noData) return;
    
    const today = new Date();
    const next7Days = new Date();
    next7Days.setDate(today.getDate() + 7);
    
    const upcoming = payments.filter(payment => {
        const dueDate = new Date(payment.dueDate);
        return payment.status === 'pending' && dueDate >= today && dueDate <= next7Days;
    }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    
    if (upcoming.length === 0) {
        tbody.innerHTML = '';
        noData.style.display = 'block';
        return;
    }
    
    noData.style.display = 'none';
    tbody.innerHTML = '';
    
    upcoming.forEach(payment => {
        const row = document.createElement('tr');
        
        const dueDate = new Date(payment.dueDate);
        const daysLeft = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        
        let statusBadge = '';
        if (daysLeft <= 0) {
            statusBadge = '<span class="status-badge status-overdue">Hoje</span>';
        } else if (daysLeft === 1) {
            statusBadge = '<span class="status-badge status-warning">Amanhã</span>';
        } else {
            statusBadge = `<span class="status-badge status-pending">${daysLeft} dias</span>`;
        }
        
        row.innerHTML = `
            <td><i class="fas fa-user"></i> ${payment.customerName}</td>
            <td>${payment.installmentNumber}</td>
            <td>${formatDate(payment.dueDate)}</td>
            <td class="amount">${formatCurrency(payment.amount)}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn-icon btn-success" title="Registrar Pagamento" onclick="showPaymentModal(${escapeHtml(JSON.stringify(payment))})">
                    <i class="fas fa-money-bill-wave"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function updateDashboard() {
    // Atualizar resumo financeiro
    const totalLoaned = loans.reduce((sum, l) => sum + l.principal, 0);
    const totalInterest = loans.reduce((sum, l) => sum + l.totalInterest, 0);
    
    // Calcular valores a receber hoje
    const today = new Date().toISOString().split('T')[0];
    const dueTodayPayments = payments.filter(p => 
        p.status === 'pending' && 
        new Date(p.dueDate).toISOString().split('T')[0] === today
    );
    const dueTodayAmount = dueTodayPayments.reduce((sum, p) => sum + p.amount, 0);
    
    // Calcular valores em atraso
    const overduePayments = payments.filter(p => {
        const dueDate = new Date(p.dueDate);
        const now = new Date();
        return p.status === 'pending' && dueDate < now;
    });
    const overdueAmount = overduePayments.reduce((sum, p) => sum + p.amount, 0);
    
    // Atualizar elementos do DOM
    if (document.getElementById('totalLoaned')) {
        document.getElementById('totalLoaned').textContent = formatCurrency(totalLoaned);
    }
    if (document.getElementById('totalInterest')) {
        document.getElementById('totalInterest').textContent = formatCurrency(totalInterest);
    }
    if (document.getElementById('dueToday')) {
        document.getElementById('dueToday').textContent = formatCurrency(dueTodayAmount);
    }
    if (document.getElementById('overdueAmount')) {
        document.getElementById('overdueAmount').textContent = formatCurrency(overdueAmount);
    }
    
    // Renderizar tabelas
    renderClientRanking();
    renderUpcomingPayments();
}

// ============================================
// RELATÓRIOS
// ============================================
function updateReports() {
    // Resumo Financeiro
    const totalLoansCount = loans.length;
    const totalLoaned = loans.reduce((sum, l) => sum + l.principal, 0);
    const totalInterest = loans.reduce((sum, l) => sum + l.totalInterest, 0);
    const profitMargin = totalLoaned > 0 ? ((totalInterest / totalLoaned) * 100) : 0;
    
    // Inadimplência
    const overduePayments = payments.filter(p => {
        const dueDate = new Date(p.dueDate);
        const now = new Date();
        return p.status === 'pending' && dueDate < now;
    });
    const overdueCount = overduePayments.length;
    const overdueValue = overduePayments.reduce((sum, p) => sum + p.amount, 0);
    const totalPayments = payments.length;
    const defaultRate = totalPayments > 0 ? ((overdueCount / totalPayments) * 100) : 0;
    
    const clientsWithOverdue = new Set(overduePayments.map(p => p.customerId)).size;
    
    // Projeção de Receitas
    const paidPayments = payments.filter(p => p.status === 'paid');
    const totalPaid = paidPayments.reduce((sum, p) => sum + p.paidAmount, 0);
    const monthlyAverage = totalPaid / 12; // Média mensal
    const expectedMonthly = monthlyAverage;
    const expectedYearly = monthlyAverage * 12;
    const monthlyGrowth = 0; // Seria calculado com base no histórico
    const roi = totalLoaned > 0 ? ((totalInterest / totalLoaned) * 100) : 0;
    
    // Atualizar elementos do DOM
    document.getElementById('totalLoansCount').textContent = totalLoansCount;
    document.getElementById('totalLoanedReport').textContent = formatCurrency(totalLoaned);
    document.getElementById('totalInterestReport').textContent = formatCurrency(totalInterest);
    document.getElementById('profitMargin').textContent = profitMargin.toFixed(2) + '%';
    
    document.getElementById('overdueCount').textContent = overdueCount;
    document.getElementById('overdueValue').textContent = formatCurrency(overdueValue);
    document.getElementById('defaultRate').textContent = defaultRate.toFixed(2) + '%';
    document.getElementById('clientsWithOverdue').textContent = clientsWithOverdue;
    
    document.getElementById('expectedMonthly').textContent = formatCurrency(expectedMonthly);
    document.getElementById('expectedYearly').textContent = formatCurrency(expectedYearly);
    document.getElementById('monthlyGrowth').textContent = monthlyGrowth.toFixed(2) + '%';
    document.getElementById('roi').textContent = roi.toFixed(2) + '%';
}

// ============================================
// GERAR RELATÓRIO EM PDF
// ============================================
function generateReportPDF() {
    showNotification('📄 Gerando relatório em PDF...', 'info');
    
    setTimeout(() => {
        const doc = new jsPDF();
        
        // Cabeçalho
        doc.setFontSize(20);
        doc.setTextColor(79, 70, 229);
        doc.text('LuCred - Relatório Financeiro', 105, 20, null, null, 'center');
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 105, 28, null, null, 'center');
        
        // Linha divisória
        doc.setLineWidth(0.5);
        doc.line(20, 35, 190, 35);
        
        let yPos = 45;
        
        // Resumo Financeiro
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text('📊 Resumo Financeiro', 20, yPos);
        yPos += 10;
        
        doc.setFontSize(10);
        doc.setTextColor(50);
        doc.text(`Total de Empréstimos: ${loans.length}`, 20, yPos);
        yPos += 6;
        doc.text(`Valor Total Emprestado: ${formatCurrency(loans.reduce((sum, l) => sum + l.principal, 0))}`, 20, yPos);
        yPos += 6;
        doc.text(`Total de Juros Recebidos: ${formatCurrency(loans.reduce((sum, l) => sum + l.totalInterest, 0))}`, 20, yPos);
        yPos += 6;
        doc.text(`Lucro Total: ${formatCurrency(loans.reduce((sum, l) => sum + l.profit, 0))}`, 20, yPos);
        yPos += 12;
        
        // Inadimplência
        const overduePayments = payments.filter(p => {
            const dueDate = new Date(p.dueDate);
            const now = new Date();
            return p.status === 'pending' && dueDate < now;
        });
        const overdueCount = overduePayments.length;
        const overdueValue = overduePayments.reduce((sum, p) => sum + p.amount, 0);
        
        doc.setFontSize(14);
        doc.text('⚠️ Inadimplência', 20, yPos);
        yPos += 10;
        
        doc.setFontSize(10);
        doc.text(`Parcelas Atrasadas: ${overdueCount}`, 20, yPos);
        yPos += 6;
        doc.text(`Valor em Atraso: ${formatCurrency(overdueValue)}`, 20, yPos);
        yPos += 6;
        doc.text(`Taxa de Inadimplência: ${((overdueCount / payments.length) * 100).toFixed(2)}%`, 20, yPos);
        yPos += 12;
        
        // Clientes
        doc.setFontSize(14);
        doc.text('👥 Clientes Cadastrados', 20, yPos);
        yPos += 10;
        
        doc.setFontSize(10);
        doc.text(`Total de Clientes: ${customers.length}`, 20, yPos);
        yPos += 6;
        
        // Top 5 clientes
        const topCustomers = customers.map(c => ({
            ...c,
            loanCount: loans.filter(l => l.customerId === c.id).length
        })).sort((a, b) => b.loanCount - a.loanCount).slice(0, 5);
        
        if (topCustomers.length > 0) {
            yPos += 4;
            doc.text('Top 5 Clientes:', 20, yPos);
            yPos += 6;
            
            topCustomers.forEach((customer, index) => {
                doc.text(`${index + 1}. ${customer.name} - ${customer.loanCount} empréstimos`, 25, yPos);
                yPos += 6;
            });
        }
        
        yPos += 8;
        
        // Empréstimos Recentes
        doc.setFontSize(14);
        doc.text('💰 Empréstimos Recentes', 20, yPos);
        yPos += 10;
        
        doc.setFontSize(10);
        const recentLoans = loans.slice(-5).reverse();
        
        if (recentLoans.length > 0) {
            recentLoans.forEach(loan => {
                if (yPos > 270) {
                    doc.addPage();
                    yPos = 20;
                }
                
                doc.text(`Cliente: ${loan.customerName}`, 20, yPos);
                yPos += 5;
                doc.text(`Valor: ${formatCurrency(loan.principal)} | Parcelas: ${loan.installments}x`, 25, yPos);
                yPos += 5;
                doc.text(`Total a Receber: ${formatCurrency(loan.totalAmount)}`, 25, yPos);
                yPos += 8;
            });
        } else {
            doc.text('Nenhum empréstimo cadastrado.', 20, yPos);
            yPos += 8;
        }
        
        // Pagamentos
        yPos += 4;
        doc.setFontSize(14);
        doc.text('💳 Pagamentos', 20, yPos);
        yPos += 10;
        
        doc.setFontSize(10);
        const paidCount = payments.filter(p => p.status === 'paid').length;
        const pendingCount = payments.filter(p => p.status === 'pending').length;
        
        doc.text(`Total de Pagamentos: ${payments.length}`, 20, yPos);
        yPos += 6;
        doc.text(`Pagos: ${paidCount} | Pendentes: ${pendingCount}`, 20, yPos);
        yPos += 6;
        doc.text(`Valor Total Recebido: ${formatCurrency(payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.paidAmount, 0))}`, 20, yPos);
        
        // Rodapé
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('LuCred - Controle Financeiro Inteligente', 105, 290, null, null, 'center');
        doc.text('© 2026 Todos os direitos reservados', 105, 295, null, null, 'center');
        
        // Salvar PDF
        doc.save(`relatorio_lucred_${new Date().toISOString().split('T')[0]}.pdf`);
        
        showNotification('✅ Relatório PDF gerado com sucesso!', 'success');
    }, 500);
}

// ============================================
// FILTROS
// ============================================
function filterCustomers() {
    const searchTerm = document.getElementById('customerSearch').value.toLowerCase();
    
    const filtered = customers.filter(customer => 
        customer.name.toLowerCase().includes(searchTerm) ||
        customer.phone.includes(searchTerm) ||
        customer.cpf.includes(searchTerm)
    );
    
    const tbody = document.getElementById('customersTable');
    const noData = document.getElementById('noCustomers');
    
    if (filtered.length === 0) {
        tbody.innerHTML = '';
        noData.style.display = 'block';
        return;
    }
    
    noData.style.display = 'none';
    tbody.innerHTML = '';
    
    filtered.forEach(customer => {
        const loanCount = loans.filter(l => l.customerId === customer.id).length;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><i class="fas fa-user"></i> ${customer.name}</td>
            <td>${customer.phone}</td>
            <td>${customer.email || '-'}</td>
            <td>${formatCPF(customer.cpf)}</td>
            <td>${loanCount}</td>
            <td><span class="status-badge status-active">Ativo</span></td>
            <td>
                <button class="btn-icon btn-warning" title="Editar" onclick="showCustomerModal(${escapeHtml(JSON.stringify(customer))})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon btn-danger" title="Excluir" onclick="deleteCustomer('${customer.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function filterLoans() {
    const searchTerm = document.getElementById('loanSearch').value.toLowerCase();
    
    const filtered = loans.filter(loan => 
        loan.customerName.toLowerCase().includes(searchTerm) ||
        loan.type.includes(searchTerm)
    );
    
    const tbody = document.getElementById('loansTable');
    const noData = document.getElementById('noLoans');
    
    if (filtered.length === 0) {
        tbody.innerHTML = '';
        noData.style.display = 'block';
        return;
    }
    
    noData.style.display = 'none';
    tbody.innerHTML = '';
    
    filtered.forEach(loan => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><i class="fas fa-user"></i> ${loan.customerName}</td>
            <td>${loan.type === 'loan' ? 'Empréstimo' : 'Veículo'}</td>
            <td class="amount">${formatCurrency(loan.principal)}</td>
            <td>${loan.interestRate}% a.m.</td>
            <td>${loan.installments}x</td>
            <td class="amount">${formatCurrency(loan.totalAmount)}</td>
            <td class="amount">${formatCurrency(loan.totalInterest)}</td>
            <td class="amount profit">${formatCurrency(loan.profit)}</td>
            <td><span class="status-badge status-active">Ativo</span></td>
            <td>
                <button class="btn-icon btn-warning" title="Editar" onclick="showLoanModal(${escapeHtml(JSON.stringify(loan))})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon btn-danger" title="Excluir" onclick="deleteLoan('${loan.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function filterPayments() {
    renderPaymentsTable();
}

// ============================================
// MODAIS AUXILIARES
// ============================================
function quickSetStatus(status) {
    if (!statusData || !statusCallback) {
        showNotification('❌ Erro ao alterar status!', 'error');
        closeModal('statusModal');
        return;
    }
    
    statusCallback(status, statusData);
    closeModal('statusModal');
}

function confirmAction(title, message, callback) {
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmActionButton').onclick = function() {
        callback();
        closeModal('confirmModal');
    };
    
    showModal('confirmModal');
}

// ============================================
// NOTIFICAÇÕES
// ============================================
function showNotification(message, type = 'info') {
    const oldToast = document.querySelector('.toast');
    if (oldToast) oldToast.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        ${message}
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    }, 100);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function escapeHtml(jsonString) {
    return jsonString.replace(/'/g, "\\'").replace(/"/g, '\\"');
}
