(function () {
  const params = new URLSearchParams(window.location.search);
  const preset = (params.get("demo") || "").toLowerCase();

  const presets = {
    staff: {
      username: "admin",
      password: "pass",
      usernameSelectors: ["#authUser", "input[name='authUser']"],
      passwordSelectors: ["#clearPass", "input[name='clearPass']"]
    },
    patient: {
      username: "mod-pat-0004@example.test",
      password: "PortalPass207!",
      usernameSelectors: ["#uname", "input[name='uname']", "#login_uname", "input[name='login_uname']"],
      passwordSelectors: ["#pass", "input[name='pass']"],
      email: "mod-pat-0004@example.test",
      emailSelectors: ["#passaddon", "input[name='passaddon']"]
    }
  };

  const selected = presets[preset];
  if (!selected) {
    return;
  }

  function setInputValue(input, value) {
    if (!input) {
      return;
    }

    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function firstElement(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element;
      }
    }
    return null;
  }

  function applyPreset() {
    setInputValue(firstElement(selected.usernameSelectors), selected.username);
    setInputValue(firstElement(selected.passwordSelectors), selected.password);
    if (selected.emailSelectors) {
      setInputValue(firstElement(selected.emailSelectors), selected.email || selected.username);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyPreset, { once: true });
  } else {
    applyPreset();
  }
})();
