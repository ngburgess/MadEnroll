// Initialization
console.log("startup");
let resultsColumn = document.querySelector('#results');
let courseNumber;
let sectionsPanel;
let validInstructorIndexes = [];
let validInstructorGpas = [];
const courseBadgeHTML = (color, gpa) => `<span matbadge=\"1\" matbadgesize=\"large\" matbadgeoverlap=\"false\" class=\"mat-badge mat-badge-above mat-badge-after mat-badge-large course-gpa-badge\"><span id=\"mat-badge-content-1\" aria-hidden=\"true\" class=\"mat-badge-content mat-badge-active course-gpa-badge stretch-badge ${color}\">${gpa}</span></span>`;
const instructorBadgeHTML = (color, gpa) => `<span matbadge=\"4\" matbadgeoverlap=\"false\" class=\"mat-badge mat-badge-below mat-badge-after mat-badge-medium instructor-gpa-badge\"><span id=\"mat-badge-content-0\" aria-hidden=\"true\" class=\"mat-badge-content mat-badge-active instructor-gpa-badge stretch-badge ${color}\">${gpa}</span></span>`;

resultsColumn.addEventListener('click', (event) => {
    // Retreive course relevent information
    sectionsPanelObserver.disconnect();
    courseName = document.querySelector('.course-title');
    courseNumber = document.querySelector('.catalog-ref').innerHTML;
    courseNumber = courseNumber.substring(0, courseNumber.indexOf("<") == -1 ? courseNumber.length : courseNumber.indexOf("<"));

    // Add course GPA badge
    console.time('api');
    chrome.runtime.sendMessage({ call: "getCourseGPA", course: courseNumber }, function (response) {
        // Remove potential existing badge
        if (document.querySelector('.mat-badge.course-gpa-badge') != null) {
            document.querySelector('.mat-badge.course-gpa-badge').remove();
        }
        document.querySelector('.catalog-ref').insertAdjacentHTML("beforeend", courseBadgeHTML(findGPAColor(response.gpa), response.gpa));
        console.timeEnd('api');
    });

    // Add course GPA graph
    createGpaChart();

    // Retreive sections panel
    sectionsPanel = document.querySelector('.mat-drawer.mat-sidenav.ng-tns-c94-2.ng-trigger.ng-trigger-transform.mat-drawer-end.mat-drawer-over.ng-star-inserted');
    sectionsPanelObserver.observe(sectionsPanel, {
        attributes: true
    })
});

let sectionsPanelObserver = new MutationObserver((mutations) => {
    // Checks if "see sections" tab is open
    let state = mutations[0].target.getAttribute("class");
    if (state == "mat-drawer mat-sidenav ng-tns-c94-2 ng-trigger ng-trigger-transform mat-drawer-end mat-drawer-over ng-star-inserted mat-drawer-opened") {
        // Waiting for page to load
        console.log("waiting");
        waitForElement('.rows').then(() => {
            console.log("running");
            let sections = document.querySelectorAll('.rows');
            for (let i = 0; i < sections.length; i++) {
                // Skip invalid rows
                if (!(sections[i].children[2].innerHTML.includes("LEC") || sections[i].children[2].innerHTML.includes("LAB") || sections[i].children[2].innerHTML.includes("IND") || sections[i].children[2].innerHTML.includes("SEM")) || sections[i].children[5].children[0].innerHTML.includes("See Details")) continue;

                // Retrieve instructor info
                let instructor = sections[i].children[5].children[0];
                let instructorName = instructor.innerHTML.substring(0, instructor.innerHTML.indexOf("<") == -1 ? instructor.innerHTML.length : instructor.innerHTML.indexOf("<"));
                // Skip rows with empty instructor name
                if (instructorName.trim().length == 0 || instructorName == '&nbsp;') continue;
                // Skip to new line if name => 18 chars
                if (instructorName.length >= 14) {
                    instructor.innerHTML = instructor.innerHTML.substring(0, instructor.innerHTML.lastIndexOf(" ")) + "<br>" + instructor.innerHTML.substring(instructor.innerHTML.lastIndexOf(" "));
                }

                // Add instructor GPA badge
                chrome.runtime.sendMessage({ call: "getInstructorGPA", course: courseNumber, instructor: instructorName.toUpperCase() }, function (response) {
                    sections[i].children[5].children[0].insertAdjacentHTML("beforeend", instructorBadgeHTML(findGPAColor(response.gpa), response.gpa));
                    validInstructorIndexes.push(i);
                    validInstructorGpas.push(response.gpa);
                });
            }
            // Enable MutationObserver to maintain instructor GPA badge existence
            maintainInstructorBadgesObserver.observe(document.querySelector('#sections'), {
                childList: true,
                subtree: true,
            });
        });
    }
    else {
        // Close and reinitialize all resources
        validInstructorIndexes = [];
        validInstructorGpas = []
        maintainInstructorBadgesObserver.disconnect();
        console.log("closed");
    }
});

let maintainInstructorBadgesObserver = new MutationObserver((mutations) => {
    let sections = document.querySelectorAll('.rows');
    console.log("maintainInstructorBadgeFired");
    for (let i = 0; i < validInstructorIndexes.length; i++) {
        if (sections[validInstructorIndexes[i]].children[5].children[0].innerHTML.indexOf("instructor-gpa-badge") == -1) {
            sections[validInstructorIndexes[i]].children[5].children[0].insertAdjacentHTML("beforeend", instructorBadgeHTML(findGPAColor(validInstructorGpas[i]), validInstructorGpas[i]));
        }
    }
});

function findGPAColor(gpa) {
    if (isNaN(gpa)) {
        return "not-found";
    } else if (gpa >= 3.25) {
        return "good-gpa";
    } else if (gpa >= 2.75) {
        return "med-gpa";
    } else {
        return "bad-gpa";
    }
}

function createGpaChart() {
    chrome.runtime.sendMessage({ call: "getCourseGPADetails", course: courseNumber }, function (response) {
        // Remove existing graph
        if (document.querySelector('#courseGpaChart') != null) {
            document.querySelector('#courseGpaChart').remove();
        }
        // Retrieve details block and add canvas area for graph
        let details = document.querySelector('[topic="Details"]');
        details.insertAdjacentHTML("afterend", "<div><canvas id=\"courseGpaChart\" height=\"300\"></canvas></div>");

        // Graph setup
        const data = {
            labels: ['A', 'AB', 'B', 'BC', 'C', 'D', 'F'],
            datasets: [{
                label: 'Course Grade Distribution',
                data: response.gpa,
                backgroundColor: [
                    'rgb(7, 198, 42)',
                    'rgb(113, 255, 10)',
                    'rgb(255, 251, 3)',
                    'rgb(255, 206, 5)',
                    'rgb(255, 162, 13)',
                    'rgb(255, 101, 13)',
                    'rgb(255, 39, 15)',
                ],
                hoverOffset: 4
            }]
        };
        const config = {
            type: 'doughnut',
            data: data,
            options: {
                maintainAspectRatio: false,
            }
        };

        // Create graph
        const courseGpaChart = new Chart(
            document.getElementById('courseGpaChart'),
            config
        );
    });
}

function waitForElement(selector) {
    return new Promise(resolve => {
        if (document.querySelector(selector)) {
            return resolve(document.querySelector(selector));
        }

        const observer = new MutationObserver(mutations => {
            if (document.querySelector(selector)) {
                resolve(document.querySelector(selector));
                observer.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}