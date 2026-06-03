export function initNavigation({ buttons, sections, defaultSection = "dashboard" }) {
  const buttonList = Array.from(buttons);
  const sectionList = Array.from(sections);

  function setActive(sectionId) {
    buttonList.forEach((button) => {
      const active = button.dataset.section === sectionId;
      button.setAttribute("aria-current", active ? "page" : "false");
    });

    sectionList.forEach((section) => {
      const active = section.dataset.sectionPanel === sectionId;
      section.classList.toggle("is-active", active);
    });
  }

  buttonList.forEach((button) => {
    button.addEventListener("click", () => setActive(button.dataset.section));
  });

  setActive(defaultSection);
  return { setActive };
}
