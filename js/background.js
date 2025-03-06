let courseGpaCache = new Map();
let uuidCache = new Map();
let instructCache = new Map(); // holds uuid id as key, then instructdict as a val for each uuid

function injectScript(tabId) {
  // chrome.scripting.executeScript({
  //   target: { tabId: tabId },
  //   files: ['/js/test.js'],
  // });
  chrome.runtime.sendMessage({call: "initalize"}, function(response){

  });
}

chrome.tabs.onActivated.addListener(function (activeInfo) {
  chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (activeInfo.tabId === tabId && changeInfo.url) {
      console.log(`URL has changed to ${changeInfo.url}`)
      if (changeInfo.url == "https://enroll.wisc.edu/search") {
        injectScript(tabId);
      }
    }
  })
})

function getInstructorGPA(jsonIN) {
  // create a dictionary to hold the instructors
  let instructDict = new Object();
  Object.entries(jsonIN).forEach((term) => {
    Object.entries(term[1]).forEach((sem) => {
      Object.values(sem[1]).forEach((c) => {
        // try-catch is needed
        try {
          Object.values(c.instructors).forEach((i) => {
            let instruct_name = i.name;
            if (instructDict.hasOwnProperty(instruct_name)) {
              instructDict[instruct_name]["a"] += c.aCount;
              instructDict[instruct_name]["ab"] += c.abCount;
              instructDict[instruct_name]["b"] += c.bCount;
              instructDict[instruct_name]["bc"] += c.bcCount;
              instructDict[instruct_name]["c"] += c.cCount;
              instructDict[instruct_name]["d"] += c.dCount;
              instructDict[instruct_name]["f"] += c.fCount;
              instructDict[instruct_name]["total"] += c.total;
              // calculates gpa
              let gpa = (instructDict[instruct_name]["a"] * 4) + (instructDict[instruct_name]["ab"] * 3.5) +
                (instructDict[instruct_name]["b"] * 3) + (instructDict[instruct_name]["bc"] * 2.5) +
                (instructDict[instruct_name]["c"] * 2) + (instructDict[instruct_name]["d"]);
              instructDict[instruct_name]["gpa"] = (gpa / instructDict[instruct_name]["total"]).toFixed(2);
            }
            else {
              let grades = new Object();
              grades["a"] = c.aCount;
              grades["ab"] = c.abCount;
              grades["b"] = c.bCount;
              grades["bc"] = c.bcCount;
              grades["c"] = c.cCount;
              grades["d"] = c.dCount;
              grades["f"] = c.fCount;
              grades["total"] = c.total;
              // calculates the gpa for an instructor
              let gpa = (grades["a"] * 4) + (grades["ab"] * 3.5) + (grades["b"] * 3)
                + (grades["bc"] * 2.5) + (grades["c"] * 2) + (grades["d"]);
              grades["gpa"] = (gpa / grades["total"]).toFixed(2);
              instructDict[instruct_name] = grades;
            }
          });
        }
        catch (err) { }
      });
    });
  });
  return instructDict;
}

function getCourseIntructorGPA(jsonIN, instructor) {
  Object.entries(jsonIN.courseOfferings).forEach(([key, offering]) => {
    console.log(key)
    console.log(offering)
    Object.entries(offering.sections).forEach(([key, section]) => {

    });
  });
}

function getGradeInfo(courseJS) {
  let gpaArr = [0, 0, 0, 0, 0, 0, 0];
  Object.entries(courseJS).forEach(([key, value]) => {
    switch (key) {
      case "aCount":
        gpaArr[0] = value;
        break;
      case "abCount":
        gpaArr[1] = value;
        break;
      case "bCount":
        gpaArr[2] = value;
        break;
      case "bcCount":
        gpaArr[3] = value;
        break;
      case "cCount":
        gpaArr[4] = value;
        break;
      case "dCount":
        gpaArr[5] = value;
        break;
      case "fCount":
        gpaArr[6] = value;
        break;
    }
  });
  return gpaArr;
}

function getCumulativeGrade(a, ab, b, bc, c, d, f) {
  let total = a + ab + b + bc + c + d + f;
  let sum = a * 4 + ab * 3.5 + b * 3 + bc * 2.5 + c * 2 + d;
  return (sum / total).toFixed(2);
}

async function getcourseJSON(courseName) {
  var apiSite = "https://api.madgrades.com/v1/";
  var token = "ff93107f38e14bc8af16d38b435fcf30";

  var uuid = uuidCache.get(courseName.toUpperCase());
  if (uuid == undefined) {
    var queryQuery = apiSite.concat('courses?query=').concat(courseName);
    const query = await fetch(queryQuery, { // calls api for query and waits for response
      headers: {
        Authorization: 'Token token='.concat(token), // authorize using our api token
      }
    })
      .then(res => res.json())
      .then(json => {
        cacheAllUUID(json.results);
        uuid = json.results[0]["uuid"]; // find uuid from response json
      }).catch(err => console.log(err));
  }

  let courseQuery = apiSite.concat("/courses/").concat(uuid).concat("/grades"); // create new api call url
  const course = await fetch(courseQuery, { // calls api for course using found uuid and waits for response
    headers: {
      Authorization: 'Token token='.concat(token)
    }
  }).catch(err => console.log(err)); // prints error if encountered
  const data = await course.json(); // waits for data from api call\
  return data; // because of async in function def, this returns a promise
}

/**
 * caches all uuids courses in a query api call
 * KEY = COURSE NAME + COURSE NUMBER
 * VALUE = COURSE UUID
 * ex. COMPUTER SCIENCE 252, a;lskfdjpoijfl;askdf;alskdfj;laskdf
 * @param {} queryJSON json that contains query from api call
 */
function cacheAllUUID(queryJSON) {
  Object.entries(queryJSON).forEach(([key, value]) => {
    uuidCache.set(value["subjects"][0]["name"] + " " + value["number"], value["uuid"]);
  });
}

/**
 * request outline
 * {
 *  call: "getCourseGPA" or "getInstructorGPA" or "getCourseInstructors"
 *  course: "CS252"
 *  instructor: "Eric Bach"
 * }
 */
chrome.runtime.onMessage.addListener(
  function (request, sender, sendResponse) {
    if (request.call == "getInstructorGPA") {
      procCourseInstructor(request.course, request.instructor, sendResponse)
      return true;
    } else if (request.call == "getCourseInstructors") {
      procInstructorGPA(request.course, sendResponse);
      return true;
    } else if (request.call == "getCourseGPA") {
      procCourseGPA(request.course, sendResponse);
      return true;
    } else if (request.call == "getCourseGPADetails") {
      procCourseGPADefails(request.course, sendResponse);
      return true;
    } else {
      sendResponse({ "Error": "Invalid Call" })
    }
  }
);

async function procCourseGPA(coursejs, sendResponse) {
  let gpa = courseGpaCache.get(coursejs);
  if (gpa != undefined) {
    sendResponse({ "gpa" : getCumulativeGrade(...gpa) });
    return;
  }
  getcourseJSON(coursejs).then(res => {
    gpa = getGradeInfo(res.cumulative);
    courseGpaCache.set(coursejs, gpa);
    sendResponse({ "gpa" : getCumulativeGrade(...gpa) });
  });
}

async function procCourseGPADefails(coursejs, sendResponse) {
  let gpa = courseGpaCache.get(coursejs);
  if (gpa != undefined) {
    sendResponse({ "gpa" : gpa });
    return;
  }
  getcourseJSON(coursejs).then(res => {
    gpa = getGradeInfo(res.cumulative);
    courseGpaCache.set(coursejs, gpa);
    sendResponse({ "gpa" : gpa });
  });
}

async function procInstructorGPA(coursejs, sendResponse) {
  getcourseJSON(coursejs).then(res => {
    const instructorGPA = getInstructorGPA(res.courseOfferings);
    sendResponse({ instructorGPA });
  });
}

async function procCourseInstructor(course, instructor, sendResponse) {
  getcourseJSON(course).then(res => {
    // if the current course is not in the instructcache, we run getInstructor to get the gpa for it
    if (!instructCache.has(res.courseUuid)) {
      instructCache.set(res.courseUuid, getInstructorGPA(res.courseOfferings));
    }
    let instructorGPA = instructCache.get(res.courseUuid);
    if (instructorGPA[instructor] == null) {
      sendResponse({ "gpa": "N/A", "course": course });
    }
    else {
      sendResponse({ "gpa": instructorGPA[instructor]["gpa"], "course": course});
      console.log(instructorGPA)
    }
  });
}