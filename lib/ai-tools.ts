import { db } from '../db';
import { FunctionDeclaration, Type } from '@google/genai';

// ===================================================================================
// ╔╦╗╔═╗╔═╗╦  ╔═╗╔═╗╔═╗╔═╗╔╦╗╔═╗╔╗╔  Tool Declarations for Gemini
// ║║║╠═╣║ ║║  ║  ║ ║╠═╣╠═╝ ║ ╠═╣║║║
// ╩ ╩╩ ╩╚═╝╩═╝╚═╝╚═╝╩ ╩╩   ╩ ╩ ╩╝╚╝
// ===================================================================================

// --- Reporting Tools ---

const getDrugStockByNameDeclaration: FunctionDeclaration = {
    name: 'getDrugStockByName',
    description: 'موجودی کل یک دارو را با جستجوی بخشی از نام آن برمی‌گرداند. این تابع می‌تواند یک نتیجه، چندین نتیجه (اگر نام مبهم باشد) یا هیچ نتیجه‌ای برنگرداند.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            drugName: { type: Type.STRING, description: 'بخشی از نام دارویی که باید جستجو شود. مثال: "آموکسی"' },
        },
        required: ['drugName'],
    },
};

const getDrugsNearingExpiryDeclaration: FunctionDeclaration = {
    name: 'getDrugsNearingExpiry',
    description: 'لیستی از داروها که تاریخ انقضای آنها در تعداد مشخصی از ماه‌های آینده است را برمی‌گرداند. اگر تعداد ماه‌ها مشخص نشود، به طور پیش‌فرض ۳ ماه آینده در نظر گرفته می‌شود.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            months: { type: Type.NUMBER, description: 'تعداد ماه‌های آینده برای بررسی تاریخ انقضا. پیش‌فرض: 3' },
        },
    },
};

const getSupplierDebtDeclaration: FunctionDeclaration = {
    name: 'getSupplierDebt',
    description: 'بدهی کل یک تامین‌کننده را با جستجوی بخشی از نام آن برمی‌گرداند. این تابع می‌تواند یک نتیجه، چندین نتیجه (اگر نام مبهم باشد) یا هیچ نتیجه‌ای برنگرداند.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            supplierName: { type: Type.STRING, description: 'بخشی از نام تامین‌کننده‌ای که باید جستجو شود. مثال: "کابل"' },
        },
        required: ['supplierName'],
    },
};

const getTodaysSalesTotalDeclaration: FunctionDeclaration = {
    name: 'getTodaysSalesTotal',
    description: 'مجموع کل فروش ثبت شده برای امروز را محاسبه و برمی‌گرداند.',
    parameters: { type: Type.OBJECT, properties: {} },
};

const getTodaysClinicRevenueDeclaration: FunctionDeclaration = {
    name: 'getTodaysClinicRevenue',
    description: 'مجموع درآمد کلینیک ثبت شده برای امروز را محاسبه و برمی‌گرداند.',
    parameters: { type: Type.OBJECT, properties: {} },
};

const listLowStockDrugsDeclaration: FunctionDeclaration = {
    name: 'listLowStockDrugs',
    description: 'لیستی از تمام داروهایی که موجودی آنها کمتر از یک آستانه مشخص است را برمی‌گرداند. اگر آستانه مشخص نشود، به طور پیش‌فرض ۱۰ عدد در نظر گرفته می‌شود.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            threshold: { type: Type.NUMBER, description: 'آستانه موجودی. پیش‌فرض: 10' },
        },
    },
};

const getFinancialSummaryForPeriodDeclaration: FunctionDeclaration = {
    name: 'getFinancialSummaryForPeriod',
    description: 'یک گزارش مالی جامع برای یک دوره زمانی مشخص (امروز، این ماه، ماه گذشته) برمی‌گرداند. این گزارش شامل مجموع فروش، سود خالص حاصل از فروش و مجموع درآمد کلینیک است.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            period: {
                type: Type.STRING,
                description: 'بازه زمانی گزارش. مقادیر مجاز: "today", "this_month", "last_month". پیش‌فرض "today" است.',
                enum: ["today", "this_month", "last_month"]
            },
        },
    },
};

const listAllDrugsDeclaration: FunctionDeclaration = {
    name: 'listAllDrugs',
    description: 'لیستی از تمام داروهای موجود در انبار را به همراه موجودی کل آنها برمی‌گرداند. برای سوالات کلی در مورد موجودی انبار استفاده شود.',
    parameters: { type: Type.OBJECT, properties: {} },
};

const listAllSuppliersWithDebtDeclaration: FunctionDeclaration = {
    name: 'listAllSuppliersWithDebt',
    description: 'لیستی از تمام تامین‌کنندگان را به همراه بدهی کل به هر یک از آنها برمی‌گرداند.',
    parameters: { type: Type.OBJECT, properties: {} },
};


export const toolDeclarations = [
    // Reporting Tools
    getDrugStockByNameDeclaration,
    getDrugsNearingExpiryDeclaration,
    getSupplierDebtDeclaration,
    getTodaysSalesTotalDeclaration,
    getTodaysClinicRevenueDeclaration,
    listLowStockDrugsDeclaration,
    getFinancialSummaryForPeriodDeclaration,
    listAllDrugsDeclaration,
    listAllSuppliersWithDebtDeclaration,
];


// ===================================================================================
// ╔═╗╔Cross_Mark╗╔═╗╦ ╦╔╦╗╔═╗  Tool Execution Logic
// ║╣ ║ ║╠═╣║ ║ ║ ║ ║ ║ ║  
// ╚═╝╚═╝╩ ╩╚═╝ ╩ ╚═╝  
// ===================================================================================

// --- Reporting Tool Implementations ---

async function _getDrugStockByName(args: { drugName: string }) {
    const searchTerms = args.drugName.toLowerCase().split(' ').filter(Boolean);
    if (searchTerms.length === 0) {
        return { success: false, message: "لطفاً نام دارو را مشخص کنید." };
    }
    
    // Dexie's filter is case-sensitive by default, so we use toLowerCase.
    const matchingDrugs = await db.drugs.filter(drug => {
        const drugNameLower = drug.name.toLowerCase();
        return searchTerms.every(term => drugNameLower.includes(term));
    }).toArray();

    if (matchingDrugs.length === 1) {
        const drug = matchingDrugs[0];
        return { success: true, name: drug.name, stock: drug.totalStock };
    }
    if (matchingDrugs.length > 1) {
        const suggestions = matchingDrugs.map(d => d.name).slice(0, 5); // Limit suggestions
        return { success: true, multipleFound: true, suggestions };
    }
    return { success: false, message: `دارویی حاوی "${args.drugName}" یافت نشد.` };
}

async function _getDrugsNearingExpiry(args: { months?: number }) {
    const months = args.months ?? 3; // Default to 3 months if not provided
    const today = new Date();
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + months);

    const expiringBatches = await db.drugBatches
        .where('expiryDate').between(today.toISOString(), targetDate.toISOString(), true, true)
        .toArray();

    if (expiringBatches.length === 0) {
        return { success: true, drugs: [] };
    }

    const drugIds = [...new Set(expiringBatches.map(b => b.drugId))];
    const drugs = await db.drugs.where('id').anyOf(drugIds).toArray();
    const drugsMap = new Map(drugs.map(d => [d.id, d.name]));

    const result = expiringBatches.map(batch => ({
        drugName: drugsMap.get(batch.drugId) || 'Unknown Drug',
        lotNumber: batch.lotNumber,
        expiryDate: batch.expiryDate,
        quantity: batch.quantityInStock,
    }));

    return { success: true, drugs: result };
}

async function _getSupplierDebt(args: { supplierName: string }) {
    const searchTerms = args.supplierName.toLowerCase().split(' ').filter(Boolean);
     if (searchTerms.length === 0) {
        return { success: false, message: "لطفاً نام تامین‌کننده را مشخص کنید." };
    }

    const matchingSuppliers = await db.suppliers.filter(supplier => {
        const supplierNameLower = supplier.name.toLowerCase();
        return searchTerms.every(term => supplierNameLower.includes(term));
    }).toArray();
    
    if (matchingSuppliers.length === 1) {
        const supplier = matchingSuppliers[0];
        return { success: true, name: supplier.name, debt: supplier.totalDebt };
    }
    if (matchingSuppliers.length > 1) {
        const suggestions = matchingSuppliers.map(s => s.name).slice(0, 5);
        return { success: true, multipleFound: true, suggestions };
    }
    return { success: false, message: `تامین‌کننده‌ای حاوی "${args.supplierName}" یافت نشد.` };
}

async function _getTodaysSalesTotal() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const invoices = await db.saleInvoices.where('date').between(today.toISOString(), tomorrow.toISOString(), true, false).toArray();
    const total = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

    return { success: true, totalSales: total, count: invoices.length };
}

async function _getTodaysClinicRevenue() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const transactions = await db.clinicTransactions.where('date').between(today.toISOString(), tomorrow.toISOString(), true, false).toArray();
    const total = transactions.reduce((sum, trans) => sum + trans.amount, 0);

    return { success: true, totalRevenue: total, count: transactions.length };
}

async function _listLowStockDrugs(args: { threshold?: number }) {
    const threshold = args.threshold ?? 10; // Default to 10 if not provided
    const drugs = await db.drugs.where('totalStock').below(threshold).toArray();
    if (drugs.length > 0) {
        const result = drugs.map(d => ({ name: d.name, stock: d.totalStock }));
        return { success: true, drugs: result };
    }
    return { success: true, drugs: [] };
}

async function _getFinancialSummaryForPeriod(args: { period?: 'today' | 'this_month' | 'last_month' }) {
    const period = args.period || 'today';
    let startDate = new Date();
    let endDate = new Date();

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    if (period === 'this_month') {
        startDate.setDate(1);
    } else if (period === 'last_month') {
        endDate = new Date(startDate.getFullYear(), startDate.getMonth(), 0);
        startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        endDate.setHours(23, 59, 59, 999);
    }

    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();

    // 1. Calculate Sales and Profit
    const saleInvoices = await db.saleInvoices.where('date').between(startISO, endISO, true, true).toArray();
    const allDrugs = await db.drugs.toArray();
    const drugCosts = new Map(allDrugs.map(d => [d.id!, Number(d.purchasePrice) || 0]));

    let totalSales = 0;
    let totalCostOfGoodsSold = 0;

    for (const invoice of saleInvoices) {
        totalSales += Number(invoice.totalAmount) || 0;
        for (const item of invoice.items) {
            const cost = drugCosts.get(item.drugId) || 0;
            // FIX: Defensively cast item.quantity to a number. Data from the database might not strictly
            // conform to the 'number' type, and this prevents runtime errors if it's null, undefined, or a non-numeric string.
            totalCostOfGoodsSold += (Number(item.quantity) || 0) * Number(cost);
        }
    }
    const netProfit = totalSales - totalCostOfGoodsSold;

    // 2. Calculate Clinic Revenue
    const clinicTransactions = await db.clinicTransactions.where('date').between(startISO, endISO, true, true).toArray();
    const totalClinicRevenue = clinicTransactions.reduce((sum, trans) => sum + trans.amount, 0);

    return {
        success: true,
        period,
        totalSales,
        netProfit,
        totalClinicRevenue,
        saleInvoicesCount: saleInvoices.length,
        clinicTransactionsCount: clinicTransactions.length
    };
}

async function _listAllDrugs() {
    const drugs = await db.drugs.toArray();
    if (drugs.length > 0) {
        const result = drugs.map(d => ({ name: d.name, stock: d.totalStock }));
        return { success: true, drugs: result };
    }
    return { success: true, drugs: [] };
}

async function _listAllSuppliersWithDebt() {
    const suppliers = await db.suppliers.toArray();
    if (suppliers.length > 0) {
        const result = suppliers.map(s => ({ name: s.name, debt: s.totalDebt }));
        return { success: true, suppliers: result };
    }
    return { success: true, suppliers: [] };
}


export async function executeTool(name: string, args: any) {
    switch (name) {
        // Reporting
        case 'getDrugStockByName':
            return await _getDrugStockByName(args);
        case 'getDrugsNearingExpiry':
            return await _getDrugsNearingExpiry(args);
        case 'getSupplierDebt':
            return await _getSupplierDebt(args);
        case 'getTodaysSalesTotal':
            return await _getTodaysSalesTotal();
        case 'getTodaysClinicRevenue':
            return await _getTodaysClinicRevenue();
        case 'listLowStockDrugs':
            return await _listLowStockDrugs(args);
        case 'getFinancialSummaryForPeriod':
            return await _getFinancialSummaryForPeriod(args);
        case 'listAllDrugs':
            return await _listAllDrugs();
        case 'listAllSuppliersWithDebt':
            return await _listAllSuppliersWithDebt();
        default:
            throw new Error(`ابزار ناشناخته: ${name}`);
    }
}
