(function () {
  var lastGeneratedDomain = "";
  var records = [];
  var currentFilter = "ALL";

  function byId(id) {
    return document.getElementById(id);
  }

  function setStatus(message) {
    var node = byId("status");
    var text = norm(message);
    node.textContent = text;
    node.style.display = text ? "block" : "none";
  }

  function norm(value) {
    return (value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }

  function getBaseDomain(name) {
    var clean = name.replace(/\.$/, "");
    var parts = clean.split(".");
    if (parts.length < 2) return clean;
    return parts.slice(-2).join(".");
  }

  function sanitizeDomain(value, fallback) {
    var clean = norm(value)
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/^\.+|\.+$/g, "")
      .replace(/\.\.+/g, ".");

    if (!clean) return fallback || "";
    if (!/^[a-z0-9.-]+$/.test(clean) || clean.indexOf(".") === -1) return fallback || "";
    return clean;
  }

  function toFqdn(value) {
    var text = norm(value);
    if (!text) return "";
    if (text.endsWith(".")) return text;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(text)) return text;
    if (/^[A-Fa-f0-9:]+$/.test(text) && text.indexOf(":") !== -1) return text;
    return text + ".";
  }

  function toAbsoluteName(name, domain) {
    var text = norm(name).replace(/\.$/, "");
    if (!text) return domain + ".";
    if (text === "@") return domain + ".";
    if (text.indexOf(".") !== -1) return text + ".";
    return text + "." + domain + ".";
  }

  function quotedTxt(text) {
    return '"' + text.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
  }

  function extractTxtParts(recordCell) {
    var parts = [];
    var nodes = recordCell.querySelectorAll('div[id^="txt_detail_"] > div');
    nodes.forEach(function (node) {
      var value = norm(node.textContent).replace(/^"+|"+$/g, "");
      if (value && value !== "path=/") parts.push(value);
    });
    if (!parts.length) {
      var fallback = norm(recordCell.textContent);
      if (fallback) parts.push(fallback);
    }
    return parts;
  }

  function parseRows(html) {
    var wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    return Array.from(wrapper.querySelectorAll("tr.recordTableRow")).filter(function (row) {
      return (
        row.querySelector('td[data-title="Name"]') &&
        row.querySelector('td[data-title="Type"]') &&
        row.querySelector('td[data-title="Record"]')
      );
    });
  }

  function parseRecordsFromPlainText(text, domainOverride, defaultTtl) {
    var lines = String(text || "").replace(/\r/g, "").split("\n").map(function (line) {
      return line.trim();
    });

    var startRe = /^(\S+)\s+(\d+)\s+(A|AAAA|CNAME|MX|SRV|TXT|CAA)\b/i;
    var starts = [];
    var i;
    for (i = 0; i < lines.length; i += 1) {
      var m = lines[i].match(startRe);
      if (m) starts.push({ idx: i, name: m[1], ttl: m[2], type: m[3].toUpperCase() });
    }

    if (!starts.length) {
      return { domain: "", records: [] };
    }

    var baseDomain = sanitizeDomain(domainOverride, getBaseDomain(starts[0].name));
    var parsed = [];

    function nonEmpty(list) {
      return list.filter(function (line) {
        return line && line.toLowerCase() !== "actions";
      });
    }

    function parseMx(linesLocal) {
      var block = linesLocal.join(" ");
      var m = block.match(/Priority:\s*(\d+).*Destination:\s*([^\s]+)/i);
      if (m) return m[1] + " " + toFqdn(m[2]);
      if (linesLocal.length) return linesLocal[0];
      return "";
    }

    function parseSrv(linesLocal) {
      var block = linesLocal.join(" ");
      var m = block.match(/Priority:\s*(\d+).*Weight:\s*(\d+).*Port:\s*(\d+).*Target:\s*([^\s]+)/i);
      if (m) return m[1] + " " + m[2] + " " + m[3] + " " + toFqdn(m[4]);
      if (linesLocal.length) return linesLocal[0];
      return "";
    }

    function parseTxt(linesLocal) {
      var parts = linesLocal.map(function (line) {
        return line.replace(/^"+|"+$/g, "");
      }).filter(Boolean);
      if (!parts.length) return "";
      return parts.map(quotedTxt).join(" ");
    }

    for (i = 0; i < starts.length; i += 1) {
      var current = starts[i];
      var nextIdx = (i + 1 < starts.length) ? starts[i + 1].idx : lines.length;
      var recordLines = nonEmpty(lines.slice(current.idx + 1, nextIdx));
      var value = "";
      var name = toAbsoluteName(current.name, baseDomain);
      var proxied = inferCfTag(name, baseDomain) === "true";

      if (current.type === "A" || current.type === "AAAA") {
        value = recordLines.length ? recordLines[0].split(" ")[0] : "";
      } else if (current.type === "CNAME") {
        value = recordLines.length ? toFqdn(recordLines[0].split(" ")[0]) : "";
      } else if (current.type === "MX") {
        value = parseMx(recordLines);
      } else if (current.type === "SRV") {
        value = parseSrv(recordLines);
      } else if (current.type === "TXT") {
        value = parseTxt(recordLines);
      } else if (current.type === "CAA") {
        value = recordLines.join(" ");
      }

      if (value) {
        parsed.push({
          name: name,
          ttl: current.ttl || defaultTtl,
          type: current.type,
          value: value,
          proxied: proxied
        });
      }
    }

    return { domain: baseDomain, records: parsed };
  }

  function parseRecordsFromHtml(rows, domainOverride, defaultTtl) {
    var firstName = norm(rows[0].querySelector('td[data-title="Name"]').textContent);
    var domain = sanitizeDomain(domainOverride, getBaseDomain(firstName));
    var parsed = [];

    rows.forEach(function (row) {
      var nameRaw = norm(row.querySelector('td[data-title="Name"]').textContent);
      var ttlRaw = norm((row.querySelector('td[data-title="TTL"]') || {}).textContent || defaultTtl);
      var type = norm(row.querySelector('td[data-title="Type"]').textContent).toUpperCase();
      var recordCell = row.querySelector('td[data-title="Record"]');
      var recordText = norm(recordCell.textContent);
      var name = toAbsoluteName(nameRaw, domain);
      var ttl = /^\d+$/.test(ttlRaw) ? ttlRaw : defaultTtl;
      var value = "";
      var proxied = inferCfTag(name, domain) === "true";

      if (type === "A" || type === "AAAA") {
        value = recordText.split(" ")[0] || "";
      } else if (type === "CNAME") {
        value = toFqdn(recordText.split(" ")[0]);
      } else if (type === "MX") {
        var mx = recordText.match(/Priority:\s*(\d+).*Destination:\s*([^\s]+)/i);
        value = mx ? (mx[1] + " " + toFqdn(mx[2])) : "";
      } else if (type === "SRV") {
        var srv = recordText.match(/Priority:\s*(\d+).*Weight:\s*(\d+).*Port:\s*(\d+).*Target:\s*([^\s]+)/i);
        value = srv ? (srv[1] + " " + srv[2] + " " + srv[3] + " " + toFqdn(srv[4])) : "";
      } else if (type === "TXT") {
        value = extractTxtParts(recordCell).map(quotedTxt).join(" ");
      } else if (type === "CAA") {
        var caa = recordText.match(/Flag:\s*(\d+).*Tag:\s*([A-Za-z0-9]+).*Value:\s*(.+)$/i);
        value = caa ? (caa[1] + " " + caa[2] + " " + quotedTxt(norm(caa[3]))) : "";
      }

      if (type && value) {
        parsed.push({ name: name, ttl: ttl, type: type, value: value, proxied: proxied });
      }
    });

    return { domain: domain, records: parsed };
  }

  function renderRecords() {
    var body = byId("recordsBody");
    body.innerHTML = "";

    records.forEach(function (record, index) {
      if (currentFilter !== "ALL" && record.type !== currentFilter) return;

      var tr = document.createElement("tr");
      tr.innerHTML = "" +
        "<td><input class='cell-input' data-key='name' data-index='" + index + "' value='" + escapeHtml(record.name) + "'></td>" +
        "<td><input class='cell-input' data-key='ttl' data-index='" + index + "' value='" + escapeHtml(record.ttl) + "'></td>" +
        "<td>" +
        "<select class='cell-select' data-key='type' data-index='" + index + "'>" +
        renderTypeOptions(record.type) +
        "</select>" +
        "</td>" +
        "<td><input class='cell-input' data-key='value' data-index='" + index + "' value='" + escapeHtml(record.value) + "'></td>" +
        "<td><select class='cell-select' data-key='proxied' data-index='" + index + "'><option value='true'" + (record.proxied ? " selected" : "") + ">true</option><option value='false'" + (!record.proxied ? " selected" : "") + ">false</option></select></td>" +
        "<td><button class='delete-btn' data-delete='" + index + "'>Delete</button></td>";
      body.appendChild(tr);
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderTypeOptions(selected) {
    return ["A", "AAAA", "CNAME", "MX", "SRV", "TXT", "CAA"].map(function (type) {
      return "<option value='" + type + "'" + (type === selected ? " selected" : "") + ">" + type + "</option>";
    }).join("");
  }

  function updateAddFormByType() {
    var type = byId("addType").value;
    var mainLabel = byId("mainValueLabel");
    var mainInput = byId("addMainValue");

    byId("extraFields").classList.add("hidden");
    byId("txtContentWrap").classList.add("hidden");
    byId("mxPriorityWrap").classList.add("hidden");
    byId("srvPriorityWrap").classList.add("hidden");
    byId("srvWeightWrap").classList.add("hidden");
    byId("srvPortWrap").classList.add("hidden");
    byId("caaFlagWrap").classList.add("hidden");
    byId("caaTagWrap").classList.add("hidden");

    var proxyVisible = (type === "A" || type === "AAAA" || type === "CNAME");
    byId("proxyContainer").classList.toggle("hidden", !proxyVisible);

    if (type === "A") {
      mainLabel.textContent = "IPv4 address (required)";
      mainInput.placeholder = "209.74.67.134";
    } else if (type === "AAAA") {
      mainLabel.textContent = "IPv6 address (required)";
      mainInput.placeholder = "2001:db8::1";
    } else if (type === "CNAME") {
      mainLabel.textContent = "Target (required)";
      mainInput.placeholder = "www.example.com";
    } else if (type === "MX") {
      mainLabel.textContent = "Mail server target (required)";
      mainInput.placeholder = "mail.example.com";
      byId("extraFields").classList.remove("hidden");
      byId("mxPriorityWrap").classList.remove("hidden");
    } else if (type === "SRV") {
      mainLabel.textContent = "SRV target (required)";
      mainInput.placeholder = "target.example.com";
      byId("extraFields").classList.remove("hidden");
      byId("srvPriorityWrap").classList.remove("hidden");
      byId("srvWeightWrap").classList.remove("hidden");
      byId("srvPortWrap").classList.remove("hidden");
    } else if (type === "TXT") {
      mainLabel.textContent = "TXT helper";
      mainInput.placeholder = "Optional single-line value";
      byId("txtContentWrap").classList.remove("hidden");
    } else if (type === "CAA") {
      mainLabel.textContent = "CAA value (required)";
      mainInput.placeholder = "letsencrypt.org";
      byId("extraFields").classList.remove("hidden");
      byId("caaFlagWrap").classList.remove("hidden");
      byId("caaTagWrap").classList.remove("hidden");
    }
  }

  function addRecordFromForm() {
    var domain = sanitizeDomain(byId("domain").value, lastGeneratedDomain || "example.com");
    var type = byId("addType").value;
    var name = toAbsoluteName(norm(byId("addName").value || "@"), domain);
    var ttlRaw = byId("addTtl").value;
    var ttl = ttlRaw === "AUTO" ? (norm(byId("defaultTtl").value) || "3600") : ttlRaw;
    var mainValue = norm(byId("addMainValue").value);
    var proxied = byId("addProxy").checked;
    var value = "";

    if (type === "A" || type === "AAAA") {
      value = mainValue;
    } else if (type === "CNAME") {
      value = toFqdn(mainValue);
    } else if (type === "MX") {
      var mxPriority = norm(byId("mxPriority").value || "10");
      value = mxPriority + " " + toFqdn(mainValue);
    } else if (type === "SRV") {
      var p = norm(byId("srvPriority").value || "0");
      var w = norm(byId("srvWeight").value || "0");
      var port = norm(byId("srvPort").value || "443");
      value = p + " " + w + " " + port + " " + toFqdn(mainValue);
    } else if (type === "TXT") {
      var txt = norm(byId("txtContent").value) || mainValue;
      value = txt ? txt.split(/\n+/).map(function (part) { return quotedTxt(norm(part)); }).join(" ") : "";
      proxied = false;
    } else if (type === "CAA") {
      var flag = norm(byId("caaFlag").value || "0");
      var tag = norm(byId("caaTag").value || "issue");
      value = flag + " " + tag + " " + quotedTxt(mainValue);
      proxied = false;
    }

    if (!name || !type || !value) {
      setStatus("Please fill required fields before adding the record.");
      return;
    }

    records.unshift({
      name: name,
      ttl: ttl,
      type: type,
      value: value,
      proxied: proxied
    });

    renderRecords();
    setStatus("Added " + type + " record at top.");
  }

  function syncRecordsFromEditor() {
    var body = byId("recordsBody");
    var next = records.map(function (record) { return Object.assign({}, record); });

    body.querySelectorAll("[data-key]").forEach(function (el) {
      var idx = Number(el.getAttribute("data-index"));
      var key = el.getAttribute("data-key");
      if (!next[idx]) return;
      if (key === "proxied") {
        next[idx][key] = el.value === "true";
      } else {
        next[idx][key] = norm(el.value);
      }
    });

    records = next.filter(function (record) {
      return record.name && record.type && record.value;
    });
  }

  function inferCfTag(name, domain) {
    var clean = name.replace(/\.$/, "").toLowerCase();
    var root = (domain || "").replace(/\.$/, "").toLowerCase();
    if (!root) return "false";
    if (clean === root || clean === "www." + root) return "true";
    if (!clean.endsWith("." + root)) return "false";

    var host = clean.slice(0, -(root.length + 1));
    if (!host || host.indexOf("_") === 0) return "false";

    var firstLabel = host.split(".")[0];
    var nonProxyHosts = {
      mail: true,
      ftp: true,
      cpanel: true,
      webmail: true,
      webdisk: true,
      whm: true,
      cpcontacts: true,
      cpcalendars: true,
      autodiscover: true,
      autoconfig: true
    };

    if (nonProxyHosts[firstLabel]) return "false";
    return "true";
  }

  function buildZone(recordList, domainOverride, defaultTtl) {
    var domain = sanitizeDomain(domainOverride, sanitizeDomain(lastGeneratedDomain, "example.com"));
    var lines = [];
    var byType = {
      A: [],
      AAAA: [],
      CNAME: [],
      MX: [],
      SRV: [],
      TXT: [],
      CAA: []
    };

    recordList.forEach(function (record) {
      var name = toAbsoluteName(record.name, domain);
      var ttl = /^\d+$/.test(record.ttl) ? record.ttl : defaultTtl;
      var type = (record.type || "").toUpperCase();
      var value = norm(record.value);
      if (!type || !value) return;

      if (type === "A" || type === "AAAA") {
        byType[type].push(name + "\t" + ttl + "\tIN\t" + type + "\t" + value + " ; cf_tags=cf-proxied:" + (record.proxied ? "true" : "false"));
      } else if (type === "CNAME") {
        byType.CNAME.push(name + "\t" + ttl + "\tIN\tCNAME\t" + toFqdn(value) + " ; cf_tags=cf-proxied:" + (record.proxied ? "true" : "false"));
      } else if (type === "MX") {
        byType.MX.push(name + "\t" + ttl + "\tIN\tMX\t" + value);
      } else if (type === "SRV") {
        byType.SRV.push(name + "\t" + ttl + "\tIN\tSRV\t" + value);
      } else if (type === "TXT") {
        byType.TXT.push(name + "\t" + ttl + "\tIN\tTXT\t" + value);
      } else if (type === "CAA") {
        byType.CAA.push(name + "\t" + ttl + "\tIN\tCAA\t" + value);
      }
    });

    function nowStamp() {
      var d = new Date();
      var p = function (n) { return String(n).padStart(2, "0"); };
      return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
    }

    lines.push(";; Domain:     " + domain + ".");
    lines.push(";; Exported:   " + nowStamp());
    lines.push(";;");
    lines.push(";; This file is generated from cPanel HTML table data.");
    lines.push(";; Review records before production use.");
    lines.push(";;");
    lines.push("");

    if (byType.A.length) {
      lines.push(";; A Records");
      lines = lines.concat(byType.A);
      lines.push("");
    }
    if (byType.AAAA.length) {
      lines.push(";; AAAA Records");
      lines = lines.concat(byType.AAAA);
      lines.push("");
    }
    if (byType.CNAME.length) {
      lines.push(";; CNAME Records");
      lines = lines.concat(byType.CNAME);
      lines.push("");
    }
    if (byType.MX.length) {
      lines.push(";; MX Records");
      lines = lines.concat(byType.MX);
      lines.push("");
    }
    if (byType.SRV.length) {
      lines.push(";; SRV Records");
      lines = lines.concat(byType.SRV);
      lines.push("");
    }
    if (byType.TXT.length) {
      lines.push(";; TXT Records");
      lines = lines.concat(byType.TXT);
      lines.push("");
    }
    if (byType.CAA.length) {
      lines.push(";; CAA Records");
      lines = lines.concat(byType.CAA);
      lines.push("");
    }

    return {
      domain: domain,
      output: lines.join("\n") + "\n"
    };
  }

  byId("generate").addEventListener("click", function () {
    syncRecordsFromEditor();
    var domain = sanitizeDomain(byId("domain").value, lastGeneratedDomain);
    var defaultTtl = /^\d+$/.test(byId("defaultTtl").value) ? byId("defaultTtl").value : "3600";

    if (!records.length) {
      byId("output").value = "";
      setStatus("No records found. Load HTML first or add records manually.");
      return;
    }

    var result = buildZone(records, domain, defaultTtl);
    byId("output").value = result.output;
    lastGeneratedDomain = result.domain;
    setStatus("Generated TXT for " + result.domain + " with " + records.length + " records.");
  });

  byId("loadHtml").addEventListener("click", function () {
    var inputText = byId("input").value;
    var domain = sanitizeDomain(byId("domain").value, "");
    var defaultTtl = /^\d+$/.test(byId("defaultTtl").value) ? byId("defaultTtl").value : "3600";
    var rows = parseRows(inputText);
    var parsed;

    if (rows.length) {
      parsed = parseRecordsFromHtml(rows, domain, defaultTtl);
    } else {
      parsed = parseRecordsFromPlainText(inputText, domain, defaultTtl);
    }

    if (!parsed.records.length) {
      setStatus("No DNS records found. Paste full HTML or copied Name/TTL/Type records text.");
      return;
    }

    records = parsed.records;
    lastGeneratedDomain = parsed.domain;
    if (!byId("domain").value) byId("domain").value = parsed.domain;
    renderRecords();
    setStatus("Loaded " + records.length + " records for " + parsed.domain + ".");
  });

  byId("addRecordTop").addEventListener("click", function () {
    syncRecordsFromEditor();
    addRecordFromForm();
  });

  byId("copy").addEventListener("click", function () {
    var output = byId("output").value;
    if (!output) {
      setStatus("Nothing to copy yet.");
      return;
    }
    navigator.clipboard.writeText(output).then(function () {
      setStatus("Output copied to clipboard.");
    }).catch(function () {
      setStatus("Clipboard copy failed. Copy manually from output box.");
    });
  });

  byId("download").addEventListener("click", function () {
    var output = byId("output").value;
    if (!output) {
      setStatus("Nothing to download yet.");
      return;
    }
    var domain = sanitizeDomain(byId("domain").value, sanitizeDomain(lastGeneratedDomain, "zone"));
    var safe = domain.replace(/[^A-Za-z0-9._-]/g, "_");
    var blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = safe + ".txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
    }, 1200);
    setStatus("Downloaded " + safe + ".txt");
  });

  byId("clear").addEventListener("click", function () {
    byId("input").value = "";
    byId("output").value = "";
    records = [];
    renderRecords();
    setStatus("Cleared.");
  });

  byId("recordsBody").addEventListener("input", function () {
    syncRecordsFromEditor();
  });

  byId("recordsBody").addEventListener("change", function () {
    syncRecordsFromEditor();
  });

  byId("recordsBody").addEventListener("click", function (event) {
    var btn = event.target.closest("button[data-delete]");
    if (!btn) return;
    syncRecordsFromEditor();
    var idx = Number(btn.getAttribute("data-delete"));
    if (!Number.isNaN(idx)) {
      records.splice(idx, 1);
      renderRecords();
      setStatus("Record removed.");
    }
  });

  byId("filters").addEventListener("click", function (event) {
    var btn = event.target.closest("button[data-filter]");
    if (!btn) return;
    currentFilter = btn.getAttribute("data-filter") || "ALL";
    byId("filters").querySelectorAll("button[data-filter]").forEach(function (item) {
      item.classList.toggle("active", item === btn);
    });
    renderRecords();
  });

  byId("addType").addEventListener("change", function () {
    updateAddFormByType();
  });

  updateAddFormByType();
  renderRecords();
})();
