import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { getRequesters } from "../api";
export function RequesterSelectionPage({ selectedRequesterId, onRequesterChange, onContinue, }) {
    const [requesters, setRequesters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [localSelection, setLocalSelection] = useState(selectedRequesterId);
    useEffect(() => {
        let active = true;
        async function loadRequesters() {
            setLoading(true);
            setError(null);
            try {
                const data = await getRequesters();
                if (!active) {
                    return;
                }
                setRequesters(data);
            }
            catch (requesterError) {
                if (!active) {
                    return;
                }
                setError(requesterError instanceof Error
                    ? requesterError.message
                    : "Unable to load requesters.");
            }
            finally {
                if (active) {
                    setLoading(false);
                }
            }
        }
        void loadRequesters();
        return () => {
            active = false;
        };
    }, []);
    const hasRequesters = requesters.length > 0;
    const selectedValue = localSelection ?? selectedRequesterId ?? "";
    return (_jsx("div", { className: "selection-page", children: _jsxs("div", { className: "selection-card", children: [_jsx("div", { className: "selection-card__icon", "aria-hidden": "true", children: "\uD83C\uDFE2" }), _jsx("h1", { className: "selection-card__title", children: "Select Development Requester" }), _jsx("p", { className: "selection-card__subtitle", children: "Select the requester used for Lab 2 testing." }), _jsxs("label", { className: "field-label", htmlFor: "development-requester", children: ["Development Requester ", _jsx("span", { "aria-hidden": "true", children: "*" })] }), loading ? (_jsx("div", { className: "field-skeleton", "aria-label": "Loading development requesters" })) : error ? (_jsxs("div", { className: "error-panel", role: "alert", children: [_jsx("strong", { children: "Unable to load requesters." }), _jsx("p", { children: error }), _jsx("button", { type: "button", className: "secondary-button", onClick: () => window.location.reload(), children: "Retry" })] })) : !hasRequesters ? (_jsxs("div", { className: "error-panel", role: "alert", children: [_jsx("strong", { children: "No active development requesters are available." }), _jsx("p", { children: "Contact an administrator." })] })) : (_jsxs("select", { id: "development-requester", className: "select-field", value: selectedValue, onChange: (event) => {
                        const nextValue = Number(event.target.value);
                        setLocalSelection(nextValue);
                        onRequesterChange(nextValue);
                    }, "aria-describedby": "requester-help-text", children: [_jsx("option", { value: "", disabled: true, children: "Select a requester" }), requesters.map((requester) => (_jsx("option", { value: requester.id, children: requester.name }, requester.id)))] })), _jsx("div", { className: "helper-text", id: "requester-help-text", children: "Only active development requesters are shown." }), _jsx("div", { className: "helper-text helper-text--muted", children: "Authentication coming in Lab 3." }), _jsxs("div", { className: "selection-actions", children: [_jsx("button", { type: "button", className: "secondary-button", children: "Cancel" }), _jsx("button", { type: "button", className: "primary-button", disabled: !localSelection || loading || !!error || !hasRequesters, onClick: () => {
                                if (localSelection) {
                                    onContinue(localSelection);
                                }
                            }, children: "\u2192 Continue" })] })] }) }));
}
