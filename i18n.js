(function () {
    const dictionaries = {
        uk: {
            counts: {
                folderEvents: {
                    one: "{count} подія",
                    few: "{count} події",
                    many: "{count} подій",
                    other: "{count} подій",
                },
                folderParticipants: {
                    one: "{count} учасник",
                    few: "{count} учасники",
                    many: "{count} учасників",
                    other: "{count} учасників",
                },
            },
        },
        pl: {
            counts: {
                folderEvents: {
                    one: "{count} wydarzenie",
                    few: "{count} wydarzenia",
                    many: "{count} wydarzeń",
                    other: "{count} wydarzeń",
                },
                folderParticipants: {
                    one: "{count} uczestnik",
                    few: "{count} uczestników",
                    many: "{count} uczestników",
                    other: "{count} uczestników",
                },
            },
        },
        en: {
            counts: {
                folderEvents: {
                    one: "{count} event",
                    other: "{count} events",
                },
                folderParticipants: {
                    one: "{count} participant",
                    other: "{count} participants",
                },
            },
        },
    };

    function normalizeLang(lang) {
        const key = String(lang || "uk").toLowerCase().split("-")[0];
        return dictionaries[key] ? key : "uk";
    }

    function pluralCategory(lang, count) {
        try {
            return new Intl.PluralRules(normalizeLang(lang)).select(Number(count) || 0);
        } catch (_) {
            return Number(count) === 1 ? "one" : "other";
        }
    }

    function formatCount(key, count, lang) {
        const safeCount = Math.max(0, Math.floor(Number(count) || 0));
        const dict = dictionaries[normalizeLang(lang)] || dictionaries.uk;
        const forms = dict.counts[key] || dictionaries.uk.counts[key];
        if (!forms) return String(safeCount);
        const category = pluralCategory(lang, safeCount);
        const template = forms[category] || forms.other || forms.many || forms.one;
        return template.replace("{count}", String(safeCount));
    }

    window.WayTandemI18n = {
        dictionaries,
        formatCount,
        normalizeLang,
        pluralCategory,
    };
}());
