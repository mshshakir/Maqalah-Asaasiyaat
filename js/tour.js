/**
 * Tour Logic using Driver.js
 */

const driver = window.driver.js.driver;

const tourDriver = driver({
    showProgress: true,
    progressText: '{{current}} من {{total}}',
    animate: true,
    allowClose: true,
    doneBtnText: 'إنهاء',
    nextBtnText: 'التالي',
    prevBtnText: 'السابق',
    steps: [
        {
            element: 'header',
            popover: {
                title: 'مرحباً بك في تطبيق تهيئة أساسيات المقالة',
                description: 'هذه جولة سريعة لتعريفك بمميزات التطبيق. يمكنك تخطيها في أي وقت.',
                side: "bottom",
                align: 'start'
            }
        },
        {
            element: '#main-tab',
            popover: {
                title: '1. العنوان والسؤال',
                description: 'ابدأ من هنا بإدخال عنوان المقالة والسؤال الرئيسي.',
                side: "bottom"
            }
        },
        {
            element: '#articleTitle',
            popover: {
                title: 'عنوان المقالة',
                description: 'أدخل العنوان المقترح للمقالة هنا.',
                side: "bottom"
            }
        },
        {
            element: '#mainQuestionEditor',
            popover: {
                title: 'السؤال الرئيسي',
                description: 'أدخل السؤال الرئيسي هنا. سيقوم التطبيق بمقارنة كلماته مع العنوان.',
                side: "top"
            }
        },
        {
            element: '#analyzeMainBtn',
            popover: {
                title: 'تحليل النص',
                description: 'اضغط هنا لتحليل التطابق. الكلمات المفقودة ستظهر باللون الأحمر.',
                side: "top"
            }
        },
        {
            element: '#sub-tab',
            popover: {
                title: '2. الأسئلة الفرعية',
                description: 'بعد الانتهاء من الصفحة الأولى، انتقل هنا لإضافة الأبواب والأسئلة الفرعية.',
                side: "bottom"
            }
        },
        {
            element: '#structure-tab',
            popover: {
                title: '3. الهيكلية التفصيلية',
                description: 'هنا يمكنك بناء الهيكلية الكاملة (فصول، مباحث، مطالب).',
                side: "bottom"
            }
        },
        {
            element: '.dropdown-toggle', // Export button usually
            popover: {
                title: 'تصدير وحفظ',
                description: 'يمكنك حفظ المشروع أو تصديره إلى Word و Excel و HTML للطباعة.',
                side: "left"
            }
        },
        {
            element: '#helpBtn',
            popover: {
                title: 'مساعدة',
                description: 'يمكنك العودة لهذا الدليل أو بدء الجولة مرة أخرى من هنا.',
                side: "bottom"
            }
        }
    ]
});

function startTour() {
    // Close modal if open
    const helpModalEl = document.getElementById('helpModal');
    const helpModal = bootstrap.Modal.getInstance(helpModalEl);
    if (helpModal) {
        helpModal.hide();
    }

    tourDriver.drive();
}

// Explicitly expose to window
window.startTour = startTour;

// Debug
console.log("Tour.js loaded");
if (!window.driver) {
    console.error("Driver.js not found!");
} else {
    console.log("Driver.js found:", window.driver);
}

// Check if first time
function checkFirstTime() {
    const seen = localStorage.getItem('maqalah_tour_seen');
    if (!seen) {
        // Show Help Modal on first load instead of auto-starting tour?
        // Or auto-start tour?
        // Let's show the Help Modal which has the "Start Tour" button. It's less aggressive.
        const helpModal = new bootstrap.Modal(document.getElementById('helpModal'));
        helpModal.show();
        localStorage.setItem('maqalah_tour_seen', 'true');
    }
}
