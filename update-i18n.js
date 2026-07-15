const fs = require('fs');
const path = require('path');

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] instanceof Object && key in target) {
      Object.assign(source[key], deepMerge(target[key], source[key]));
    }
  }
  Object.assign(target || {}, source);
  return target;
}

function updateTranslation(locale, updates) {
  const filePath = path.join('src', 'messages', locale + '.json');
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const newContent = deepMerge(content, updates);
  fs.writeFileSync(filePath, JSON.stringify(newContent, null, 2));
}

const enUpdates = {
  pharmacy: {
    dispensing: {
      title: "Prescription Dispensing",
      subtitle: "Review prescriptions from doctors and dispense medications",
      searchPatient: "Search by patient...",
      table: {
        patient: "Patient",
        prescribedBy: "Prescribed By",
        date: "Date",
        status: "Status",
        dispense: "Dispense",
        drPrefix: "Dr. "
      }
    },
    inventory: {
      title: "Stock Inventory",
      subtitle: "Manage medication batches and stock levels",
      searchStock: "Search stock...",
      table: {
        medication: "Medication",
        batchNumber: "Batch #",
        quantity: "Quantity",
        units: " units",
        status: "Status",
        transfer: "Transfer"
      }
    },
    medications: {
      title: "Medications Catalog",
      subtitle: "Master list of all clinic medications and drugs",
      addMedication: "Add Medication",
      searchMedications: "Search medications...",
      table: {
        medicationName: "Medication Name",
        category: "Category",
        form: "Form",
        strength: "Strength"
      }
    },
    orders: {
      title: "Purchase Orders",
      subtitle: "Manage medication orders and track deliveries from suppliers",
      createOrder: "Create Order",
      searchSupplier: "Search by supplier...",
      table: {
        orderNumber: "Order #",
        supplier: "Supplier",
        dateIssued: "Date Issued",
        amount: "Amount",
        status: "Status"
      }
    }
  }
};

const arUpdates = {
  pharmacy: {
    dispensing: {
      title: "صرف الروشتات",
      subtitle: "راجع روشتات الدكاترة واصرف الأدوية",
      searchPatient: "بحث باسم المريض...",
      table: {
        patient: "المريض",
        prescribedBy: "وصف بواسطة",
        date: "التاريخ",
        status: "الحالة",
        dispense: "صرف",
        drPrefix: "د. "
      }
    },
    inventory: {
      title: "جرد المخزون",
      subtitle: "إدارة دفعات الأدوية ومستويات المخزون",
      searchStock: "بحث في المخزون...",
      table: {
        medication: "الدواء",
        batchNumber: "رقم التشغيلة (Batch)",
        quantity: "الكمية",
        units: " وحدات",
        status: "الحالة",
        transfer: "نقل"
      }
    },
    medications: {
      title: "كتالوج الأدوية",
      subtitle: "القائمة الأساسية لكل أدوية وعقاقير العيادة",
      addMedication: "إضافة دواء",
      searchMedications: "بحث في الأدوية...",
      table: {
        medicationName: "اسم الدواء",
        category: "التصنيف",
        form: "الشكل",
        strength: "التركيز"
      }
    },
    orders: {
      title: "طلبات الشراء",
      subtitle: "إدارة طلبات الأدوية وتتبع التسليم من الموردين",
      createOrder: "إنشاء طلب",
      searchSupplier: "بحث باسم المورد...",
      table: {
        orderNumber: "رقم الطلب",
        supplier: "المورد",
        dateIssued: "تاريخ الإصدار",
        amount: "المبلغ",
        status: "الحالة"
      }
    }
  }
};

const frUpdates = {
  pharmacy: {
    dispensing: {
      title: "Délivrance d'ordonnances",
      subtitle: "Examiner les ordonnances des médecins et délivrer les médicaments",
      searchPatient: "Recherche par patient...",
      table: {
        patient: "Patient",
        prescribedBy: "Prescrit Par",
        date: "Date",
        status: "Statut",
        dispense: "Délivrer",
        drPrefix: "Dr. "
      }
    },
    inventory: {
      title: "Inventaire des Stocks",
      subtitle: "Gérer les lots de médicaments et les niveaux de stock",
      searchStock: "Rechercher dans les stocks...",
      table: {
        medication: "Médicament",
        batchNumber: "Lot n°",
        quantity: "Quantité",
        units: " unités",
        status: "Statut",
        transfer: "Transférer"
      }
    },
    medications: {
      title: "Catalogue des Médicaments",
      subtitle: "Liste principale de tous les médicaments de la clinique",
      addMedication: "Ajouter un Médicament",
      searchMedications: "Rechercher des médicaments...",
      table: {
        medicationName: "Nom du Médicament",
        category: "Catégorie",
        form: "Forme",
        strength: "Dosage"
      }
    },
    orders: {
      title: "Bons de Commande",
      subtitle: "Gérer les commandes de médicaments et suivre les livraisons des fournisseurs",
      createOrder: "Créer une Commande",
      searchSupplier: "Recherche par fournisseur...",
      table: {
        orderNumber: "Commande n°",
        supplier: "Fournisseur",
        dateIssued: "Date d'émission",
        amount: "Montant",
        status: "Statut"
      }
    }
  }
};

updateTranslation('en', enUpdates);
updateTranslation('ar', arUpdates);
updateTranslation('fr', frUpdates);
