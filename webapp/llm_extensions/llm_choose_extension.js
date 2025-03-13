//import "./llm_extension_with_qa_extension_steps.js";
//import "./llm_extension_with_qa_extension_no_data.js";
//import "./llm_extension_direct_sparql.js";

document.addEventListener("DOMContentLoaded", () => {
  const scripts = [
    "llm_extension_with_qa_extension_steps.js",
  ];

  scripts.forEach((script) => {
    const s = document.createElement("script");
    s.src = `./llm_extensions/${script}`;
    s.async = false; // Ensures scripts run in order
    document.head.appendChild(s);
  });
});
