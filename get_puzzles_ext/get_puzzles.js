doThing = () => {
  const waittime = 1000;
  const elements = document.getElementsByClassName("ArchiveViewer-calendarItem--1AhvT");
  const elements1 = [];
  for (i in elements) {
    elements1.push(elements[i]);
  }
  elements1.pop();
  elements1.pop();
  elements1.pop();
  const elements2 = elements1.map(
    (e) => e.getElementsByClassName("index-printAndDownloadTools--2RCkM"));
  const elements3 = elements2.map((e) => {
    const x = [];
    if (e.length === 0) {
      return;
    }
    const e2 = e[0].getElementsByTagName("a");
    for (i in e2) {
      x[i] = e2[i];
    }
    return x[1];
  });

  let x = 1;

  elements3.forEach(function(e) {
    if (e) {
      setTimeout(() => {
        e.click();
      }, 2000 + (x * waittime));
      x++;
    }
  });
  setTimeout(() => {
    let pathname = window.location.pathname;
    const length = pathname.length;
    const month = pathname.substring(length-2);
    let newpathname;
    if (month === "01") {
      const year = parseInt(pathname.substring(length-7, length-3));
      pathname = pathname.replace(year, year-1);
      newpathname = pathname.substring(0, length-2) + "12";
    } else {
      const i = parseInt(month);
      let newI = month.replace(i, i-1);
      if (newI.length < 2) {
        newI = "0" + newI;
      }
      newpathname = pathname.substring(0, length-2) + newI;
    }
    window.location.pathname = newpathname;
  }, (x * waittime) + 4000);
}

window.onload = doThing;
