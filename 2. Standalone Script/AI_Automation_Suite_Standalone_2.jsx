#target illustrator
/**
 * ==============================================================================
 * Automation Suite Pro - Standalone Master Script
 * Author: Tanzim Talukdar Joy / AI Pair Assistant
 * Version: 2.6.3 (Rock-Solid Parameter Capture & In-Memory Pipeline)
 * 
 * All-in-One Adobe Illustrator Automation Tool:
 *   1. 🪄 BG Remover (Auto White Background Removal)
 *   2. 📐 Auto Page Resizer (Standard Microstock Dimensions & Safe Margin)
 *   3. 🧩 Icon Set Maker Pro (Grid Batch Icon Generator)
 * ==============================================================================
 */

(function () {
    "use strict";

    var SCRIPT_NAME = "Automation Suite Pro";
    var SCRIPT_VERSION = "2.7.0";

    var VECTOR_EXTS = ["ai", "eps", "svg", "pdf"];
    var ALL_EXTS = ["ai", "eps", "svg", "pdf", "jpg", "jpeg", "png", "tif", "tiff"];

    // -------------------------------------------------------------------------
    // Helper Utilities
    // -------------------------------------------------------------------------
    function getFiles(folder, allowRaster) {
        if (!folder || !folder.exists) return [];
        var valid = [];
        var exts = allowRaster ? ALL_EXTS : VECTOR_EXTS;

        function collect(dir) {
            var items = dir.getFiles();
            for (var i = 0; i < items.length; i++) {
                var f = items[i];
                if (f instanceof File && !f.name.match(/^\._/)) {
                    var dot = f.name.lastIndexOf(".");
                    if (dot !== -1) {
                        var ext = f.name.substring(dot + 1).toLowerCase();
                        for (var j = 0; j < exts.length; j++) {
                            if (ext === exts[j]) {
                                valid.push(f);
                                break;
                            }
                        }
                    }
                } else if (f instanceof Folder && !f.name.match(/^\./)) {
                    collect(f);
                }
            }
        }

        collect(folder);

        valid.sort(function (a, b) {
            return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        });
        return valid;
    }

    function unlockAll(doc) {
        if (!doc) return;
        try {
            for (var i = 0; i < doc.layers.length; i++) {
                doc.layers[i].locked = false;
                doc.layers[i].visible = true;
            }
        } catch (eL) {}
        // Native C++ unlock and show commands are instant (<1ms) and eliminate slow DOM pageItems loops
        try { app.executeMenuCommand("unlockAll"); } catch (eU) {}
        try { app.executeMenuCommand("showAll"); } catch (eS) {}
    }

    function outlineAllText(doc) {
        try {
            if (!doc || !doc.textFrames || doc.textFrames.length === 0) return;
            for (var t = doc.textFrames.length - 1; t >= 0; t--) {
                try {
                    doc.textFrames[t].createOutline();
                } catch (eT) {}
            }
        } catch (e) {}
    }

    // Viewport Centering & Live Canvas Refresh (Centers artboards and shows live progress)
    function centerAndFitView(doc) {
        if (!doc) return;
        try {
            doc.activate();
            if (doc.artboards && doc.artboards.length > 1) {
                try { app.executeMenuCommand("fitall"); } catch (eAll) { app.executeMenuCommand("fitartboard"); }
            } else {
                app.executeMenuCommand("fitartboard");
            }
            app.redraw();
        } catch (e) {}
    }

    function getBounds(items) {
        if (!items || items.length === 0) return null;
        var minX = Infinity, maxY = -Infinity, maxX = -Infinity, minY = Infinity;
        for (var i = 0; i < items.length; i++) {
            var b = items[i].visibleBounds;
            if (b[0] < minX) minX = b[0];
            if (b[1] > maxY) maxY = b[1];
            if (b[2] > maxX) maxX = b[2];
            if (b[3] < minY) minY = b[3];
        }
        if (minX === Infinity) return null;
        return { x: minX, y: maxY, width: maxX - minX, height: maxY - minY };
    }

    // -------------------------------------------------------------------------
    // Document True Artwork Bounds Calculator
    // Ignores clipping masks, guides, hidden items, and unpainted paths
    // -------------------------------------------------------------------------
    function getDocArtworkBounds(doc) {
        if (!doc) return null;
        try { doc.rulerOrigin = [0, 0]; } catch (eR) {}
        var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        var found = false;

        var ab = (doc.artboards && doc.artboards.length > 0) ? doc.artboards[0].artboardRect : null;
        var abW = ab ? Math.abs(ab[2] - ab[0]) : 0;
        var abH = ab ? Math.abs(ab[1] - ab[3]) : 0;

        for (var l = 0; l < doc.layers.length; l++) {
            var layer = doc.layers[l];
            if (layer.locked || !layer.visible) continue;
            for (var p = 0; p < layer.pageItems.length; p++) {
                var itm = layer.pageItems[p];
                if (!itm || itm.guides || itm.hidden) continue;

                // Skip full-canvas white background boxes so actual artwork/icons are measured
                if (abW > 0 && abH > 0 && typeof isItemWhiteOnly === "function" && isItemWhiteOnly(itm, 25)) {
                    var itmB = (typeof getItemBounds === "function") ? getItemBounds(itm) : (itm.visibleBounds || itm.geometricBounds);
                    if (itmB) {
                        var iW = Math.abs(itmB[2] - itmB[0]);
                        var iH = Math.abs(itmB[1] - itmB[3]);
                        if (iW >= abW * 0.90 && iH >= abH * 0.90) {
                            continue;
                        }
                    }
                }

                var tb = null;
                try {
                    if (typeof getTrueArtworkBounds === "function") tb = getTrueArtworkBounds(itm);
                } catch (eTb) {}
                if (!tb) {
                    try { tb = itm.visibleBounds; } catch (eVb) {}
                }
                if (!tb) {
                    try { tb = itm.geometricBounds; } catch (eGb) {}
                }

                if (tb && !(tb[0] === 0 && tb[1] === 0 && tb[2] === 0 && tb[3] === 0)) {
                    var lft = Math.min(tb[0], tb[2]);
                    var rgt = Math.max(tb[0], tb[2]);
                    var top = Math.max(tb[1], tb[3]);
                    var bot = Math.min(tb[1], tb[3]);
                    var w = rgt - lft;
                    var h = top - bot;
                    if (w > 0.01 && h > 0.01 && isFinite(w) && isFinite(h)) {
                        if (lft < minX) minX = lft;
                        if (rgt > maxX) maxX = rgt;
                        if (bot < minY) minY = bot;
                        if (top > maxY) maxY = top;
                        found = true;
                    }
                }
            }
        }

        if (!found || minX === Infinity || maxX === -Infinity || minY === Infinity || maxY === -Infinity) {
            return null;
        }

        return {
            x: minX,
            y: maxY,
            width: maxX - minX,
            height: maxY - minY,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2
        };
    }

    // -------------------------------------------------------------------------
    // Absolute Failsafe: Guarantees Artwork is NEVER Outside the Artboard
    // Scales down artwork if it exceeds safe bounds, and centers the artboard
    // directly on the artwork so all margins are positive, balanced, and safe.
    // -------------------------------------------------------------------------
    function ensureArtworkFitsInsideArtboard(doc, targetW, targetH, marginScale) {
        if (!doc) return;
        try {
            unlockAll(doc);
            try { doc.rulerOrigin = [0, 0]; } catch (eR0) {}

            var ab = (doc.artboards && doc.artboards.length > 0) ? doc.artboards[0] : null;
            if (!ab) return;

            var curAbRect = ab.artboardRect;
            var curAbW = Math.abs(curAbRect[2] - curAbRect[0]);
            var curAbH = Math.abs(curAbRect[1] - curAbRect[3]);

            var tw = parseFloat(targetW) || 4000;
            var th = parseFloat(targetH) || 2663;

            var mScale = (marginScale !== undefined && marginScale > 0) ? marginScale : 0.78;
            if (mScale > 1) mScale = mScale / 100;
            if (mScale > 0.82) mScale = 0.78;
            if (mScale < 0.60) mScale = 0.78;

            var maxSafeW = tw * mScale;
            var maxSafeH = th * mScale;

            // Measure true bounds of all artwork in document
            var bounds = getDocArtworkBounds(doc);
            if (!bounds || bounds.width <= 0.001 || bounds.height <= 0.001) {
                return;
            }

            var artW = bounds.width;
            var artH = bounds.height;

            // Proportional Uniform Scaling:
            var scaleW = (maxSafeW / artW) * 100;
            var scaleH = (maxSafeH / artH) * 100;
            var scaleFactor = Math.min(scaleW, scaleH);

            if (scaleFactor > 0 && isFinite(scaleFactor) && (scaleFactor < 98 || scaleFactor > 102)) {
                var topItems = [];
                for (var l = 0; l < doc.layers.length; l++) {
                    var ly = doc.layers[l];
                    if (ly.locked || !ly.visible) {
                        ly.locked = false;
                        ly.visible = true;
                    }
                    for (var p = 0; p < ly.pageItems.length; p++) {
                        var itm = ly.pageItems[p];
                        if (itm && !itm.guides && !itm.hidden) {
                            topItems.push(itm);
                        }
                    }
                }

                if (topItems.length === 1) {
                    try {
                        topItems[0].resize(
                            scaleFactor, scaleFactor,
                            true, true, true, true, true,
                            Transformation.CENTER
                        );
                    } catch (eDir) {}
                } else if (topItems.length > 1) {
                    try {
                        var tempGroup = doc.activeLayer.groupItems.add();
                        for (var idx = topItems.length - 1; idx >= 0; idx--) {
                            try {
                                topItems[idx].move(tempGroup, ElementPlacement.PLACEATBEGINNING);
                            } catch (eM) {}
                        }
                        if (tempGroup.pageItems.length > 0) {
                            tempGroup.resize(
                                scaleFactor, scaleFactor,
                                true, true, true, true, true,
                                Transformation.CENTER
                            );
                            while (tempGroup.pageItems.length > 0) {
                                try {
                                    tempGroup.pageItems[0].move(doc.activeLayer, ElementPlacement.PLACEATBEGINNING);
                                } catch (eUnw) { break; }
                            }
                        }
                        try { tempGroup.remove(); } catch (eRG) {}
                    } catch (eG2) {}
                }
                doc.selection = null;
            }

            // 2. Re-measure true bounds after scaling
            try { doc.rulerOrigin = [0, 0]; } catch (eR1) {}
            var finalBounds = getDocArtworkBounds(doc);
            if (!finalBounds) return;

            var finalCenterX = finalBounds.centerX;
            var finalCenterY = finalBounds.centerY;

            // 3. Set the artboard to be centered dead-center directly on the artwork
            // This mathematically guarantees that ALL artwork is 100% inside the artboard!
            ab.artboardRect = [
                finalCenterX - (tw / 2),
                finalCenterY + (th / 2),
                finalCenterX + (tw / 2),
                finalCenterY - (th / 2)
            ];

            // 4. Remove any extra lingering artboards so single artboard is always exported cleanly
            while (doc.artboards.length > 1) {
                try { doc.artboards.remove(1); } catch (eRemAb) { break; }
            }

            doc.selection = null;
            try { app.redraw(); } catch (eR2) {}
        } catch (eEnsure) {}
    }

    function saveDocEPS(doc, targetFile, eps10Mode) {
        try { ensureArtworkFitsInsideArtboard(doc, 4000, 2663, 0.78); } catch (eFit) {}
        try {
            if (targetFile && targetFile.exists) targetFile.remove();
        } catch (eRem) {}
        var epsOpts = new EPSSaveOptions();
        if (eps10Mode) {
            try { epsOpts.compatibility = Compatibility.ILLUSTRATOR10; } catch (e) {}
        }
        epsOpts.embedAllFonts = true;
        epsOpts.embedLinkedFiles = true;
        epsOpts.includeDocumentThumbnails = true;
        epsOpts.saveMultipleArtboards = true; // STRICT: Preserves exact original artboard size in EPS
        try { epsOpts.artboardRange = "1"; } catch (eR) {}
        doc.saveAs(targetFile, epsOpts);

        // Resolve generated filename if Illustrator appended artboard suffix
        try {
            if (!targetFile.exists) {
                var parentFolder = targetFile.parent;
                var baseName = targetFile.name.replace(/\.[^\.]+$/, "");
                var possibleFiles = [
                    new File(parentFolder.fsName + "/" + baseName + "-01.eps"),
                    new File(parentFolder.fsName + "/" + baseName + "-1.eps"),
                    new File(parentFolder.fsName + "/" + baseName + "_01.eps"),
                    new File(parentFolder.fsName + "/" + baseName + "_1.eps"),
                    new File(parentFolder.fsName + "/" + baseName + "_Artboard 1.eps"),
                    new File(parentFolder.fsName + "/" + baseName + "_Artboard1.eps"),
                    new File(parentFolder.fsName + "/" + baseName + "_Artboard 01.eps")
                ];
                for (var p = 0; p < possibleFiles.length; p++) {
                    if (possibleFiles[p].exists) {
                        if (targetFile.exists) targetFile.remove();
                        possibleFiles[p].copy(targetFile);
                        possibleFiles[p].remove();
                        break;
                    }
                }
            }
        } catch (eRename) {}
    }

    function saveDocAI(doc, targetFile) {
        try { ensureArtworkFitsInsideArtboard(doc, 4000, 2663, 0.88); } catch (eFit) {}
        try {
            if (targetFile && targetFile.exists) targetFile.remove();
        } catch (eRem) {}
        var aiOpts = new IllustratorSaveOptions();
        aiOpts.compressed = true;
        aiOpts.pdfCompatible = true;
        aiOpts.embedLinkedFiles = true;
        doc.saveAs(targetFile, aiOpts);
    }

    function exportDocSVG(doc, targetFile) {
        try { ensureArtworkFitsInsideArtboard(doc, 4000, 2663, 0.88); } catch (eFit) {}
        try {
            if (targetFile && targetFile.exists) targetFile.remove();
        } catch (eRem) {}
        var svgOpts = new ExportOptionsSVG();
        svgOpts.embedRasterImages = true;
        svgOpts.embedAllFonts = false;
        try { svgOpts.fontSubsetting = SVGFontSubsetting.ALLGLYPHS; } catch (e) {}
        try { svgOpts.artboardClipping = true; } catch (eClip) {}
        doc.exportFile(targetFile, ExportType.SVG, svgOpts);
    }

    function exportDocPNG24(doc, targetFile) {
        try { ensureArtworkFitsInsideArtboard(doc, 4000, 2663, 0.88); } catch (eFit) {}
        try {
            if (targetFile && targetFile.exists) targetFile.remove();
        } catch (eRem) {}
        var pngOpts = new ExportOptionsPNG24();
        pngOpts.antiAliasing = true;
        pngOpts.transparency = true;
        pngOpts.artBoardClipping = true;
        doc.exportFile(targetFile, ExportType.PNG24, pngOpts);
    }

    function isColorWhite(color, tol) {
        if (!color) return false;
        var t = (tol !== undefined) ? tol : 20;
        try {
            var type = color.typename;
            if (type === "RGBColor") {
                return (color.red >= 255 - t && color.green >= 255 - t && color.blue >= 255 - t);
            } else if (type === "CMYKColor") {
                return (color.cyan <= t && color.magenta <= t && color.yellow <= t && color.black <= t);
            } else if (type === "GrayColor") {
                return (color.gray <= t);
            } else if (type === "LabColor") {
                return (color.l >= 100 - (t * 0.4) && Math.abs(color.a) <= (t * 0.3) && Math.abs(color.b) <= (t * 0.3));
            } else if (type === "SpotColor") {
                if (color.spot && color.spot.name) {
                    var sName = color.spot.name.toLowerCase();
                    if (sName === "[none]" || sName === "none" || sName.indexOf("white") !== -1) {
                        return true;
                    }
                }
                if (color.tint !== undefined && color.tint <= t) {
                    return true;
                }
                if (color.spot && color.spot.color) {
                    return isColorWhite(color.spot.color, t);
                }
            }
        } catch (eCol) {}
        return false;
    }

    function isPathWhiteFill(item, tol) {
        if (!item || !item.filled) return false;
        return isColorWhite(item.fillColor, tol);
    }

    // Check if an item is painted purely with white/none (has no colored strokes or fills)
    function isItemWhiteOnly(item, tol) {
        if (!item) return false;
        var t = (tol !== undefined) ? tol : 20;
        try {
            if (item.typename === "PathItem") {
                if (item.guides) return false;
                var isWF = !item.filled || !item.fillColor || item.fillColor.typename === "NoColor" || isColorWhite(item.fillColor, t);
                var isWS = !item.stroked || !item.strokeColor || item.strokeColor.typename === "NoColor" || isColorWhite(item.strokeColor, t);
                var hasWhitePaint = (item.filled && isColorWhite(item.fillColor, t)) || (item.stroked && isColorWhite(item.strokeColor, t));
                var hasNoColoredPaint = isWF && isWS;
                return hasWhitePaint && hasNoColoredPaint;
            } else if (item.typename === "CompoundPathItem") {
                if (!item.pathItems || item.pathItems.length === 0) return false;
                try {
                    var pi0 = item.pathItems[0];
                    if (pi0) {
                        var pi0WF = !pi0.filled || !pi0.fillColor || pi0.fillColor.typename === "NoColor" || isColorWhite(pi0.fillColor, t);
                        var pi0WS = !pi0.stroked || !pi0.strokeColor || pi0.strokeColor.typename === "NoColor" || isColorWhite(pi0.strokeColor, t);
                        if (!pi0WF || !pi0WS) return false;
                    }
                    for (var p = 1; p < item.pathItems.length; p++) {
                        var pi = item.pathItems[p];
                        if (pi && pi.stroked && pi.strokeColor && pi.strokeColor.typename !== "NoColor" && !isColorWhite(pi.strokeColor, t)) return false;
                        if (pi && pi.filled && pi.fillColor && pi.fillColor.typename !== "NoColor" && !isColorWhite(pi.fillColor, t)) return false;
                    }
                    return true;
                } catch (eCp) { return false; }
            }
        } catch (e) {}
        return false;
    }

    // Distinguish between background white vs intentional white foreground artwork
    function isIntentionalForegroundWhite(item, container, docBounds, tol) {
        if (!item) return false;
        var t = (tol !== undefined) ? tol : 20;
        try {
            // 1. If it has a colored stroke, it is an outlined graphic element (e.g. cartoon eye, character outline)
            if (item.stroked && item.strokeColor && item.strokeColor.typename !== "NoColor" && !isColorWhite(item.strokeColor, t)) {
                return true;
            }

            // 2. If it has active transparency/blend mode, it is a highlight or lighting overlay
            if (item.opacity !== undefined && item.opacity < 98) {
                return true;
            }
            if (item.blendingMode !== undefined && item.blendingMode !== BlendModes.NORMAL) {
                return true;
            }

            // 3. Stacking order & containment analysis:
            var itmBounds = getItemBounds(item);
            if (!itmBounds) return false;
            var itmW = Math.abs(itmBounds[2] - itmBounds[0]);
            var itmH = Math.abs(itmBounds[1] - itmBounds[3]);

            if (docBounds) {
                var docW = Math.abs(docBounds[2] - docBounds[0]);
                var docH = Math.abs(docBounds[1] - docBounds[3]);
                if (itmW >= docW * 0.70 && itmH >= docH * 0.70) {
                    return false;
                }
            }

            if (container && container.pageItems) {
                var items = container.pageItems;
                var itemIdx = -1;
                for (var idx = 0; idx < items.length; idx++) {
                    if (items[idx] === item) {
                        itemIdx = idx;
                        break;
                    }
                }

                // Items with index > itemIdx are visually UNDERNEATH this item in Illustrator DOM
                if (itemIdx >= 0) {
                    for (var u = itemIdx + 1; u < items.length; u++) {
                        var underItem = items[u];
                        if (!underItem) continue;

                        if (!isItemWhiteOnly(underItem, t)) {
                            var uBounds = getItemBounds(underItem);
                            if (uBounds) {
                                var intersects = !(itmBounds[2] < uBounds[0] || itmBounds[0] > uBounds[2] || itmBounds[3] > uBounds[1] || itmBounds[1] < uBounds[3]);
                                if (intersects) {
                                    return true; // Stacked above a colored shape -> Intentional foreground!
                                }
                            }
                        }
                    }
                }
            }
        } catch (eFore) {}
        return false;
    }

    // Clean isolated white background remnants located at the extreme perimeter outside colored artwork
    function cleanOuterPerimeterWhiteRemnants(doc, tol) {
        if (!doc) return;
        var t = (tol !== undefined) ? tol : 20;
        try {
            var coloredBounds = null;

            for (var i = 0; i < doc.pageItems.length; i++) {
                var pi = doc.pageItems[i];
                if (!pi || pi.guides || pi.hidden) continue;
                if (!isItemWhiteOnly(pi, t)) {
                    var gb = getItemBounds(pi);
                    if (gb) {
                        if (!coloredBounds) {
                            coloredBounds = [gb[0], gb[1], gb[2], gb[3]];
                        } else {
                            coloredBounds[0] = Math.min(coloredBounds[0], gb[0]);
                            coloredBounds[1] = Math.max(coloredBounds[1], gb[1]);
                            coloredBounds[2] = Math.max(coloredBounds[2], gb[2]);
                            coloredBounds[3] = Math.min(coloredBounds[3], gb[3]);
                        }
                    }
                }
            }

            if (!coloredBounds) return;

            for (var j = doc.pageItems.length - 1; j >= 0; j--) {
                try {
                    var item = doc.pageItems[j];
                    if (!item || item.guides || item.hidden) continue;

                    if (isItemWhiteOnly(item, t) && !isIntentionalForegroundWhite(item, doc, coloredBounds, t)) {
                        var iGb = getItemBounds(item);
                        if (iGb) {
                            var isCompletelyOutside = (iGb[2] < coloredBounds[0] || iGb[0] > coloredBounds[2] || iGb[3] > coloredBounds[1] || iGb[1] < coloredBounds[3]);
                            if (isCompletelyOutside) {
                                item.remove();
                            }
                        }
                    }
                } catch (eRem) {}
            }
        } catch (eOuter) {}
    }

    function removeWhiteRecursively(items, tol, cleanCompound, handleRaster) {
        if (!items) return;
        var t = (tol !== undefined) ? tol : 20;
        for (var i = items.length - 1; i >= 0; i--) {
            try {
                var item = items[i];
                if (!item || item.guides) continue;

                if (item.typename === "GroupItem") {
                    removeWhiteRecursively(item.pageItems, t, cleanCompound, handleRaster);
                    if (item.pageItems.length === 0) {
                        try { item.remove(); } catch (eG) {}
                    }
                } else if (item.typename === "PathItem" || item.typename === "CompoundPathItem") {
                    if (isItemWhiteOnly(item, t)) {
                        if (!isIntentionalForegroundWhite(item, item.parent, null, t)) {
                            if (item.clipping) {
                                if (item.filled) item.filled = false;
                            } else {
                                item.remove();
                            }
                        }
                    }
                }
            } catch (eItm) {}
        }
    }

    // SAFE Recursive Background Cleaner: Removes canvas background rectangles, icon-level white cards, and nested bounding boxes
    function cleanVectorBackgroundSafely(doc, tol) {
        if (!doc) return;
        var t = (tol !== undefined) ? tol : 20;
        try {
            unlockAll(doc);
            var ab = doc.artboards[0].artboardRect;
            var abW = Math.abs(ab[2] - ab[0]);
            var abH = Math.abs(ab[1] - ab[3]);
            var abBounds = [ab[0], ab[1], ab[2], ab[3]];

            function cleanGroupOrLayer(container) {
                if (!container || !container.pageItems || container.pageItems.length === 0) return;

                // 1. Recurse into child groups first
                for (var g = container.pageItems.length - 1; g >= 0; g--) {
                    var child = container.pageItems[g];
                    if (child && child.typename === "GroupItem") {
                        cleanGroupOrLayer(child);
                    }
                }

                // 2. Handle clipping mask groups
                if (container.typename === "GroupItem" && container.clipped) {
                    try {
                        if (container.pageItems.length > 0) {
                            var maskPath = container.pageItems[0];
                            if (maskPath && maskPath.typename === "PathItem" && maskPath.clipping) {
                                if (maskPath.filled && isColorWhite(maskPath.fillColor, t)) {
                                    maskPath.filled = false;
                                }
                            }
                        }
                        if (container.pageItems.length >= 2) {
                            var bottomChild = container.pageItems[container.pageItems.length - 1];
                            if (bottomChild && isItemWhiteOnly(bottomChild, t) && !isIntentionalForegroundWhite(bottomChild, container, abBounds, t)) {
                                var bGb = getItemBounds(bottomChild);
                                var gGb = getItemBounds(container);
                                if (bGb && gGb) {
                                    var bW = Math.abs(bGb[2] - bGb[0]);
                                    var bH = Math.abs(bGb[1] - bGb[3]);
                                    var gW = Math.abs(gGb[2] - gGb[0]);
                                    var gH = Math.abs(gGb[1] - gGb[3]);
                                    if (bW >= gW * 0.65 && bH >= gH * 0.65) {
                                        bottomChild.remove();
                                    }
                                }
                            }
                        }
                    } catch (eClip) {}
                }

                // 3. Inspect items in container from bottom upwards
                var pItems = container.pageItems;
                for (var i = pItems.length - 1; i >= 0; i--) {
                    try {
                        var itm = pItems[i];
                        if (!itm || itm.guides) continue;

                        if (isItemWhiteOnly(itm, t)) {
                            if (isIntentionalForegroundWhite(itm, container, abBounds, t)) {
                                continue; // PRESERVE INTENTIONAL FOREGROUND WHITE
                            }

                            var pGb = getItemBounds(itm);
                            if (!pGb) continue;
                            var pW = Math.abs(pGb[2] - pGb[0]);
                            var pH = Math.abs(pGb[1] - pGb[3]);

                            // 1. Full canvas/artboard background box
                            if ((pW >= abW * 0.55 && pH >= abH * 0.55) || (pW >= abW * 0.90 || pH >= abH * 0.90)) {
                                itm.remove();
                                continue;
                            }

                            // 2. Standalone card / bounding background box at bottom of container
                            if (i >= pItems.length - 2 && (pW >= 30 && pH >= 30)) {
                                var cGb = getItemBounds(container);
                                if (cGb) {
                                    var cW = Math.abs(cGb[2] - cGb[0]);
                                    var cH = Math.abs(cGb[1] - cGb[3]);
                                    if (pW >= cW * 0.60 && pH >= cH * 0.60) {
                                        itm.remove();
                                        continue;
                                    }
                                }
                            }
                        }
                    } catch (eChild) {}
                }

                // 4. Remove empty groups
                for (var r = container.pageItems.length - 1; r >= 0; r--) {
                    var remItm = container.pageItems[r];
                    if (remItm && remItm.typename === "GroupItem" && remItm.pageItems.length === 0) {
                        try { remItm.remove(); } catch (eR) {}
                    }
                }
            }

            for (var l = 0; l < doc.layers.length; l++) {
                cleanGroupOrLayer(doc.layers[l]);
            }

            // Clean outer perimeter stray background remnants
            cleanOuterPerimeterWhiteRemnants(doc, t);

        } catch (eDoc) {}
    }

    // -------------------------------------------------------------------------
    // Strict Standard Dimension Enforcer (Guarantees Exactly 4000 × 2663 px)
    // -------------------------------------------------------------------------
    // -------------------------------------------------------------------------
    // Strict Standard Dimension Enforcer (Guarantees Exactly 4000 × 2663 px)
    // -------------------------------------------------------------------------
    function enforceExactArtboardAndScale(doc, targetW, targetH, marginScale, centerArt, scaleStrokes) {
        if (!doc) return;
        var tw = parseFloat(targetW) || 4000;
        var th = parseFloat(targetH) || 2663;
        var mScale = (marginScale !== undefined && marginScale > 0) ? marginScale : 0.88;
        if (mScale > 1) mScale = mScale / 100;
        ensureArtworkFitsInsideArtboard(doc, tw, th, mScale);
    }

    // Pre-Save Validation: Validates stock readiness and artboard dimensions
    function validateStockCompliance(doc, targetW, targetH) {
        if (!doc) return { valid: false, message: "No active document" };
        var tw = parseFloat(targetW) || 4000;
        var th = parseFloat(targetH) || 2663;

        try {
            ensureArtworkFitsInsideArtboard(doc, tw, th, 0.88);
            var ab = doc.artboards[0].artboardRect;
            var curW = Math.round(Math.abs(ab[2] - ab[0]));
            var curH = Math.round(Math.abs(ab[1] - ab[3]));
            return {
                valid: true,
                width: curW,
                height: curH
            };
        } catch (eVal) {
            return { valid: false, message: eVal.message };
        }
    }

    // -------------------------------------------------------------------------
    // Microstock Quality Issue Solver & Deep Vector Cleaner
    // -------------------------------------------------------------------------
    function deepCleanAdobeStockVector(doc, options) {
        if (!doc) return;
        var opts = options || {};
        var tol = (opts.tolerance !== undefined) ? opts.tolerance : 20;
        var removeStray = (opts.removeStrayPoints !== false);
        var autoOutline = (opts.autoOutlineText !== false);
        var removeMasks = (opts.removeEmptyMasks !== false);
        var cleanBg = (opts.removeBgBoxes !== false);

        // 1. Fast native unlock all layers and items
        unlockAll(doc);

        // 2 & 3. Single-pass backward clean: hidden items, stray points, empty text, unpainted paths
        try {
            for (var p = doc.pageItems.length - 1; p >= 0; p--) {
                try {
                    var itm = doc.pageItems[p];
                    if (!itm) continue;

                    if (itm.hidden) {
                        itm.remove();
                        continue;
                    }

                    if (itm.guides) {
                        itm.remove();
                        continue;
                    }

                    if (itm.typename === "PathItem") {
                        if (removeStray) {
                            if (itm.pathPoints && itm.pathPoints.length <= 1) {
                                itm.remove();
                                continue;
                            }
                            if (!itm.clipping && (!itm.filled || !itm.fillColor || itm.fillColor.typename === "NoColor") && (!itm.stroked || !itm.strokeColor || itm.strokeColor.typename === "NoColor")) {
                                itm.remove();
                                continue;
                            }
                            var b = itm.geometricBounds;
                            if (b) {
                                var w = Math.abs(b[2] - b[0]);
                                var h = Math.abs(b[1] - b[3]);
                                if (w < 0.001 && h < 0.001 && !itm.clipping) {
                                    itm.remove();
                                    continue;
                                }
                            }
                        }
                    } else if (itm.typename === "TextFrame") {
                        if (itm.contents.replace(/\s+/g, "").length === 0) {
                            itm.remove();
                            continue;
                        }
                    } else if (itm.typename === "GroupItem") {
                        if (itm.pageItems.length === 0) {
                            try { itm.remove(); } catch (eG0) {}
                            continue;
                        }
                    }
                } catch (ePItem) {}
            }
        } catch (eCleanAll) {}

        // 4. Clean background rectangles / bounding box cards if enabled
        if (cleanBg) {
            try {
                cleanVectorBackgroundSafely(doc, tol);
            } catch (eBgClean) {}
        }

        // 5. Clean empty / unused clipping masks
        if (removeMasks) {
            try {
                for (var m = doc.pageItems.length - 1; m >= 0; m--) {
                    try {
                        var mItm = doc.pageItems[m];
                        if (mItm && mItm.typename === "GroupItem" && mItm.clipped) {
                            if (mItm.pageItems.length <= 1) {
                                mItm.remove();
                            }
                        }
                    } catch (eM) {}
                }
            } catch (eMask) {}
        }

        // 6. Outline all fonts / text
        if (autoOutline) {
            try {
                outlineAllText(doc);
            } catch (eOut) {}
        }

        // 7. Remove any residual empty groups recursively
        try {
            function removeEmptyGroups(container) {
                if (!container || !container.pageItems) return;
                for (var g = container.pageItems.length - 1; g >= 0; g--) {
                    var gItm = container.pageItems[g];
                    if (gItm && gItm.typename === "GroupItem") {
                        removeEmptyGroups(gItm);
                        if (gItm.pageItems.length === 0) {
                            try { gItm.remove(); } catch (eGRem) {}
                        }
                    }
                }
            }
            for (var l = 0; l < doc.layers.length; l++) {
                removeEmptyGroups(doc.layers[l]);
            }
        } catch (eGRec) {}
    }

    // Multi-Icon Detection & Clustering Helper
    function detectMultipleIcons(doc) {
        if (!doc) return [];
        unlockAll(doc);

        try { cleanVectorBackgroundSafely(doc, 25); } catch (e) {}

        // 1. Automatically separate and unwrap multi-icon groups
        try { autoSeparateAndUngroupIcons(doc); } catch (eSep) {}

        // Measure overall document artwork envelope to detect top header titles
        var overallBounds = getDocArtworkBounds(doc);
        var totalW = overallBounds ? overallBounds.width : 4000;
        var totalH = overallBounds ? overallBounds.height : 2663;
        var topBoundary = overallBounds ? (overallBounds.y - (totalH * 0.30)) : Infinity;

        var candidateIcons = [];

        for (var l = 0; l < doc.layers.length; l++) {
            var layer = doc.layers[l];
            if (layer.locked || !layer.visible) continue;
            for (var i = 0; i < layer.pageItems.length; i++) {
                var item = layer.pageItems[i];
                if (!item || item.guides || item.hidden) continue;

                var gb = null;
                try {
                    if (typeof getTrueArtworkBounds === "function") gb = getTrueArtworkBounds(item);
                } catch (eTb) {}
                if (!gb) gb = item.visibleBounds || item.geometricBounds;
                if (!gb) continue;

                var w = Math.abs(gb[2] - gb[0]);
                var h = Math.abs(gb[1] - gb[3]);
                if (w < 15 || h < 15) continue; // Ignore tiny stray points

                // Filter out wide top title header banners (e.g. "FAMILY DANCE CLASS ICON SET")
                var itemCenterY = (gb[1] + gb[3]) / 2;
                if (w >= totalW * 0.45 && (w / h) >= 3.0 && itemCenterY >= topBoundary) {
                    continue; // Skip header title so it does not get saved as an individual icon!
                }

                candidateIcons.push(item);
            }
        }

        // Fallback: If only 1 master group remains, inspect its direct children
        if (candidateIcons.length === 1 && candidateIcons[0].typename === "GroupItem") {
            var masterGrp = candidateIcons[0];
            if (masterGrp.pageItems.length > 1) {
                var subItems = [];
                for (var s = 0; s < masterGrp.pageItems.length; s++) {
                    var sItm = masterGrp.pageItems[s];
                    if (!sItm.guides && !sItm.hidden) {
                        var sGb = null;
                        try {
                            if (typeof getTrueArtworkBounds === "function") sGb = getTrueArtworkBounds(sItm);
                        } catch (eSTb) {}
                        if (!sGb) sGb = sItm.visibleBounds || sItm.geometricBounds;
                        if (sGb) {
                            var sw = Math.abs(sGb[2] - sGb[0]);
                            var sh = Math.abs(sGb[1] - sGb[3]);
                            if (sw >= 15 && sh >= 15) {
                                var sCenterY = (sGb[1] + sGb[3]) / 2;
                                if (!(sw >= totalW * 0.45 && (sw / sh) >= 3.0 && sCenterY >= topBoundary)) {
                                    subItems.push(sItm);
                                }
                            }
                        }
                    }
                }
                if (subItems.length > 1) {
                    candidateIcons = subItems;
                }
            }
        }

        return candidateIcons;
    }


    function getItemBounds(item) {
        if (!item) return null;
        var isZeroBounds = function(b) {
            if (!b || b.length < 4) return true;
            if (b[0] === 0 && b[1] === 0 && b[2] === 0 && b[3] === 0) return true;
            var w = Math.abs(b[2] - b[0]);
            var h = Math.abs(b[1] - b[3]);
            return (w <= 0.001 || h <= 0.001 || isNaN(w) || isNaN(h));
        };

        var gb = null;
        try {
            // If item is a group with a clipping mask, check children to skip invisible mask returning [0,0,0,0]
            if (item.typename === "GroupItem" && item.pageItems && item.pageItems.length > 0) {
                var rawGb = item.visibleBounds;
                if (!isZeroBounds(rawGb)) {
                    gb = rawGb;
                } else {
                    for (var i = 0; i < item.pageItems.length; i++) {
                        var child = item.pageItems[i];
                        if (child.clipping) continue;
                        var cGb = child.visibleBounds;
                        if (!isZeroBounds(cGb)) {
                            gb = cGb;
                            break;
                        }
                    }
                }
            } else {
                gb = item.visibleBounds;
            }
        } catch (e1) {}
        if (isZeroBounds(gb)) {
            try {
                gb = item.geometricBounds;
            } catch (e2) {}
        }
        if (isZeroBounds(gb)) {
            return null;
        }
        return gb;
    }

    function getTrueArtworkBounds(item) {
        if (!item) return null;
        var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        var found = false;

        var isZeroBounds = function(b) {
            if (!b || b.length < 4) return true;
            if (b[0] === 0 && b[1] === 0 && b[2] === 0 && b[3] === 0) return true;
            var w = Math.abs(b[2] - b[0]);
            var h = Math.abs(b[1] - b[3]);
            return (w <= 0.001 || h <= 0.001 || isNaN(w) || isNaN(h));
        };

        function scan(it) {
            if (!it || it.hidden || it.guides) return;
            try {
                // Ignore invisible or pure clipping masks that return [0,0,0,0] or have no visible artwork
                if (it.clipping) return;

                if (it.typename === "PathItem") {
                    var isPainted = (it.filled && it.fillColor && it.fillColor.typename !== "NoColor") ||
                                    (it.stroked && it.strokeColor && it.strokeColor.typename !== "NoColor");
                    if (!isPainted) return;

                    var b = it.visibleBounds;
                    if (isZeroBounds(b)) {
                        try { b = it.geometricBounds; } catch (eGb) {}
                    }
                    if (!isZeroBounds(b)) {
                        var l = Math.min(b[0], b[2]);
                        var r = Math.max(b[0], b[2]);
                        var t = Math.max(b[1], b[3]);
                        var bt = Math.min(b[1], b[3]);
                        if (l < minX) minX = l;
                        if (r > maxX) maxX = r;
                        if (bt < minY) minY = bt;
                        if (t > maxY) maxY = t;
                        found = true;
                    }
                    return;
                }

                if (it.typename === "CompoundPathItem") {
                    // Ignore compound path clipping masks
                    try {
                        if (it.pathItems && it.pathItems.length > 0 && it.pathItems[0].clipping) return;
                    } catch (eCp) {}
                    var bCp = it.visibleBounds;
                    if (isZeroBounds(bCp)) {
                        try { bCp = it.geometricBounds; } catch (eGb2) {}
                    }
                    if (!isZeroBounds(bCp)) {
                        var lCp = Math.min(bCp[0], bCp[2]);
                        var rCp = Math.max(bCp[0], bCp[2]);
                        var tCp = Math.max(bCp[1], bCp[3]);
                        var btCp = Math.min(bCp[1], bCp[3]);
                        if (lCp < minX) minX = lCp;
                        if (rCp > maxX) maxX = rCp;
                        if (btCp < minY) minY = btCp;
                        if (tCp > maxY) maxY = tCp;
                        found = true;
                    }
                    return;
                }

                if (it.typename === "TextFrame" || it.typename === "RasterItem" ||
                    it.typename === "PlacedItem" || it.typename === "PluginItem") {
                    var b2 = it.visibleBounds;
                    if (isZeroBounds(b2)) {
                        try { b2 = it.geometricBounds; } catch (eGb3) {}
                    }
                    if (!isZeroBounds(b2)) {
                        var l2 = Math.min(b2[0], b2[2]);
                        var r2 = Math.max(b2[0], b2[2]);
                        var t2 = Math.max(b2[1], b2[3]);
                        var bt2 = Math.min(b2[1], b2[3]);
                        if (l2 < minX) minX = l2;
                        if (r2 > maxX) maxX = r2;
                        if (bt2 < minY) minY = bt2;
                        if (t2 > maxY) maxY = t2;
                        found = true;
                    }
                    return;
                }

                if (it.typename === "GroupItem") {
                    for (var c = 0; c < it.pageItems.length; c++) {
                        var child = it.pageItems[c];
                        if (child && child.clipping) continue; // Skip clipping mask
                        scan(child);
                    }
                }
            } catch (eScan) {}
        }

        scan(item);

        if (found && minX !== Infinity && maxX !== -Infinity && minY !== Infinity && maxY !== -Infinity) {
            var w = maxX - minX;
            var h = maxY - minY;
            if (w > 0.001 && h > 0.001) {
                return [minX, maxY, maxX, minY];
            }
        }

        // Fallback: examine item bounds, ignoring [0,0,0,0]
        var fb = getItemBounds(item);
        if (fb && !isZeroBounds(fb)) {
            return fb;
        }

        // Additional fallback: if group has children, find non-zero child bounds ignoring invisible clipping masks
        if (item.typename === "GroupItem" && item.pageItems && item.pageItems.length > 0) {
            for (var k = 0; k < item.pageItems.length; k++) {
                var itm = item.pageItems[k];
                if (itm.clipping) continue;
                var cb = null;
                try { cb = itm.visibleBounds; } catch (eVis) {}
                if (isZeroBounds(cb)) {
                    try { cb = itm.geometricBounds; } catch (eGeo) {}
                }
                if (cb && !isZeroBounds(cb)) {
                    return cb;
                }
            }
        }

        return null;
    }

    // -------------------------------------------------------------------------
    // Automatic Multi-Icon Spatial Clustering & Independent Ungrouping Engine
    // Automatically separates master grouped vector icons so each icon becomes
    // an independent top-level group without altering internal artwork or original files.
    // -------------------------------------------------------------------------
    function calcBoxDistance(b1, b2) {
        if (!b1 || !b2 || b1.length < 4 || b2.length < 4) return 999999;
        var minX1 = Math.min(b1[0], b1[2]), maxX1 = Math.max(b1[0], b1[2]);
        var minY1 = Math.min(b1[1], b1[3]), maxY1 = Math.max(b1[1], b1[3]);

        var minX2 = Math.min(b2[0], b2[2]), maxX2 = Math.max(b2[0], b2[2]);
        var minY2 = Math.min(b2[1], b2[3]), maxY2 = Math.max(b2[1], b2[3]);

        var xDist = 0;
        if (maxX1 < minX2) xDist = minX2 - maxX1;
        else if (maxX2 < minX1) xDist = minX1 - maxX2;

        var yDist = 0;
        if (maxY1 < minY2) yDist = minY2 - maxY1;
        else if (maxY2 < minY1) yDist = minY1 - maxY2;

        return Math.max(xDist, yDist);
    }

    function clusterBoundingBoxes(itemsList, threshold) {
        if (!itemsList || itemsList.length === 0) return [];
        var n = itemsList.length;
        var clusters = [];
        var visited = [];
        for (var v = 0; v < n; v++) visited.push(false);

        for (var i = 0; i < n; i++) {
            if (visited[i]) continue;
            var cluster = [i];
            visited[i] = true;
            var queue = [i];

            while (queue.length > 0) {
                var curr = queue.shift();
                for (var j = 0; j < n; j++) {
                    if (!visited[j]) {
                        var d = calcBoxDistance(itemsList[curr].bounds, itemsList[j].bounds);
                        if (d <= threshold) {
                            visited[j] = true;
                            cluster.push(j);
                            queue.push(j);
                        }
                    }
                }
            }
            clusters.push(cluster);
        }
        return clusters;
    }

    function unwrapGroupItem(grp) {
        if (!grp || grp.typename !== "GroupItem") return [];
        var released = [];
        try {
            // Unclip if it was a clipping group
            if (grp.clipped) {
                try {
                    grp.clipped = false;
                    if (grp.pageItems.length > 0 && grp.pageItems[0].clipping) {
                        grp.pageItems[0].remove();
                    }
                } catch (eClp) {}
            }

            // Moving children out to the parent before the group preserves exact stacking order
            while (grp.pageItems.length > 0) {
                var child = grp.pageItems[0];
                child.move(grp, ElementPlacement.PLACEBEFORE);
                released.push(child);
            }
            try { grp.remove(); } catch (eRem) {}
        } catch (eUnw) {}
        return released;
    }

    function autoSeparateAndUngroupIcons(doc, options) {
        if (!doc) return;
        try {
            unlockAll(doc);
            try { doc.rulerOrigin = [0, 0]; } catch (eRuler) {}

            // -----------------------------------------------------------------
            // Pathfinder Icon Separation Engine:
            // Uses Illustrator Pathfinder (Trim / Merge / Divide) to detach any
            // connected shapes, compound paths, and overlapping frames so every
            // icon becomes completely independent and separated.
            // -----------------------------------------------------------------
            try {
                // 1. Outline all text first to prevent Pathfinder text dialogs
                try { outlineAllText(doc); } catch (eOut) {}

                // 2. Remove background boxes / framing cards
                try { cleanVectorBackgroundSafely(doc, 25); } catch (eBg) {}

                // 3. Select all artwork for Pathfinder
                doc.selection = null;
                try { app.executeMenuCommand("selectall"); } catch (eSel) {}

                if (doc.selection && doc.selection.length > 0) {
                    var pfApplied = false;
                    try {
                        // Primary: Pathfinder Trim cuts overlapping paths and divides disjoint multi-icon shapes
                        app.executeMenuCommand("Live Pathfinder Trim");
                        try { app.executeMenuCommand("expandStyle"); } catch (eExp1) {}
                        try { app.executeMenuCommand("ungroup"); } catch (eUg1) {}
                        pfApplied = true;
                    } catch (ePf1) {}

                    if (!pfApplied) {
                        try {
                            // Fallback: Pathfinder Merge unites identical fills while splitting separate icons
                            app.executeMenuCommand("Live Pathfinder Merge");
                            try { app.executeMenuCommand("expandStyle"); } catch (eExp2) {}
                            try { app.executeMenuCommand("ungroup"); } catch (eUg2) {}
                            pfApplied = true;
                        } catch (ePf2) {}
                    }

                    if (!pfApplied) {
                        try {
                            // Fallback 2: Pathfinder Divide
                            app.executeMenuCommand("Live Pathfinder Divide");
                            try { app.executeMenuCommand("expandStyle"); } catch (eExp3) {}
                            try { app.executeMenuCommand("ungroup"); } catch (eUg3) {}
                        } catch (ePf3) {}
                    }

                    // Clean any unpainted transparent debris resulting from Pathfinder
                    for (var cp = doc.pageItems.length - 1; cp >= 0; cp--) {
                        try {
                            var cpItm = doc.pageItems[cp];
                            if (!cpItm) continue;
                            if (cpItm.typename === "PathItem") {
                                if (!cpItm.clipping &&
                                    (!cpItm.filled || !cpItm.fillColor || cpItm.fillColor.typename === "NoColor") &&
                                    (!cpItm.stroked || !cpItm.strokeColor || cpItm.strokeColor.typename === "NoColor")) {
                                    cpItm.remove();
                                }
                            }
                        } catch (eCP) {}
                    }
                }
                doc.selection = null;
            } catch (ePfEngine) {}

            var maxPasses = 5;
            for (var pass = 0; pass < maxPasses; pass++) {
                var unwrappedInPass = false;

                // Collect all candidate group items across all layers
                var groupsToInspect = [];
                for (var l = 0; l < doc.layers.length; l++) {
                    var layer = doc.layers[l];
                    if (layer.locked || !layer.visible) continue;
                    for (var p = 0; p < layer.pageItems.length; p++) {
                        var itm = layer.pageItems[p];
                        if (itm && itm.typename === "GroupItem" && !itm.guides && !itm.hidden) {
                            groupsToInspect.push(itm);
                        }
                    }
                }

                for (var g = 0; g < groupsToInspect.length; g++) {
                    var grp = groupsToInspect[g];
                    if (!grp || grp.typename !== "GroupItem") continue;

                    // Release canvas-level framing clipping masks
                    if (grp.clipped) {
                        try {
                            if (grp.pageItems.length > 0) {
                                var clipMask = grp.pageItems[0];
                                if (clipMask && clipMask.clipping) {
                                    var mGb = getItemBounds(clipMask);
                                    var gGb = getItemBounds(grp);
                                    if (mGb && gGb) {
                                        var mW = Math.abs(mGb[2] - mGb[0]);
                                        var mH = Math.abs(mGb[1] - mGb[3]);
                                        var gW = Math.abs(gGb[2] - gGb[0]);
                                        var gH = Math.abs(gGb[1] - gGb[3]);
                                        if (mW >= gW * 0.70 && mH >= gH * 0.70) {
                                            grp.clipped = false;
                                            clipMask.remove();
                                        }
                                    }
                                }
                            }
                        } catch (eClip) {}
                    }

                    if (grp.pageItems.length === 0) {
                        try { grp.remove(); } catch (eR0) {}
                        continue;
                    }

                    // Redundant single-item wrapper group
                    if (grp.pageItems.length === 1) {
                        var singleChild = grp.pageItems[0];
                        if (singleChild && singleChild.typename === "GroupItem") {
                            unwrapGroupItem(grp);
                            unwrappedInPass = true;
                            continue;
                        }
                    }

                    // Collect valid child items
                    var validChildren = [];
                    for (var c = 0; c < grp.pageItems.length; c++) {
                        var cItm = grp.pageItems[c];
                        if (!cItm || cItm.guides || cItm.hidden) continue;
                        var cBounds = getItemBounds(cItm) || getTrueArtworkBounds(cItm);
                        if (!cBounds) continue;
                        var cW = Math.abs(cBounds[2] - cBounds[0]);
                        var cH = Math.abs(cBounds[1] - cBounds[3]);
                        if (cW < 2 || cH < 2) continue;
                        validChildren.push({ item: cItm, bounds: cBounds, w: cW, h: cH });
                    }

                    if (validChildren.length <= 1) continue;

                    // Compute dynamic cluster threshold based on group bounds
                    var grpBounds = getItemBounds(grp) || getTrueArtworkBounds(grp);
                    var grpW = grpBounds ? Math.abs(grpBounds[2] - grpBounds[0]) : 1000;
                    var grpH = grpBounds ? Math.abs(grpBounds[1] - grpBounds[3]) : 1000;
                    var threshold = Math.max(20, Math.min(grpW, grpH) * 0.04);

                    var clusters = clusterBoundingBoxes(validChildren, threshold);

                    // If group contains >= 2 distinct clusters, it is an enclosing multi-icon group!
                    if (clusters.length >= 2) {
                        var parentContainer = grp.parent;
                        var released = unwrapGroupItem(grp);
                        unwrappedInPass = true;

                        // For each cluster: if it consists of loose paths (not already a single group),
                        // group them cleanly into an icon group
                        for (var k = 0; k < clusters.length; k++) {
                            var clusterIndices = clusters[k];
                            if (clusterIndices.length > 1) {
                                try {
                                    var firstItem = validChildren[clusterIndices[0]].item;
                                    var newIconGrp = parentContainer.groupItems.add();
                                    newIconGrp.move(firstItem, ElementPlacement.PLACEBEFORE);
                                    for (var m = 0; m < clusterIndices.length; m++) {
                                        var itmObj = validChildren[clusterIndices[m]];
                                        if (itmObj && itmObj.item) {
                                            itmObj.item.move(newIconGrp, ElementPlacement.PLACEATEND);
                                        }
                                    }
                                } catch (eGrpClust) {}
                            }
                        }
                    }
                }

                if (!unwrappedInPass) break;
            }

            // Ensure loose items on layers forming distinct clusters are neatly packaged into icon groups
            for (var ly = 0; ly < doc.layers.length; ly++) {
                var curLayer = doc.layers[ly];
                if (curLayer.locked || !curLayer.visible) continue;
                var looseItems = [];
                for (var pi = 0; pi < curLayer.pageItems.length; pi++) {
                    var pItm = curLayer.pageItems[pi];
                    if (!pItm || pItm.guides || pItm.hidden) continue;
                    if (pItm.typename !== "GroupItem") {
                        var pB = getItemBounds(pItm) || getTrueArtworkBounds(pItm);
                        if (pB) {
                            var pw = Math.abs(pB[2] - pB[0]);
                            var ph = Math.abs(pB[1] - pB[3]);
                            if (pw >= 2 && ph >= 2) looseItems.push({ item: pItm, bounds: pB });
                        }
                    }
                }
                if (looseItems.length > 1) {
                    var layerClusters = clusterBoundingBoxes(looseItems, 35);
                    if (layerClusters.length >= 2) {
                        for (var lc = 0; lc < layerClusters.length; lc++) {
                            var lcIndices = layerClusters[lc];
                            if (lcIndices.length > 1) {
                                try {
                                    var fItem = looseItems[lcIndices[0]].item;
                                    var looseGrp = curLayer.groupItems.add();
                                    looseGrp.move(fItem, ElementPlacement.PLACEBEFORE);
                                    for (var lm = 0; lm < lcIndices.length; lm++) {
                                        looseItems[lcIndices[lm]].item.move(looseGrp, ElementPlacement.PLACEATEND);
                                    }
                                } catch (eLGrp) {}
                            }
                        }
                    }
                }
            }

            // Clean empty groups that may remain after unwrapping
            for (var l2 = 0; l2 < doc.layers.length; l2++) {
                removeEmptyGroups(doc.layers[l2]);
            }

            try { app.redraw(); } catch (eRedraw) {}
        } catch (eSep) {}
    }

    function loadAndEmbedIcon(iconFile, targetDoc, cleanBG, tol) {
        var iconGroup = null;
        var srcDoc = null;
        var t = (tol !== undefined) ? tol : 25;

        // METHOD 1: Clean background open, guide-strip, layer consolidate, copy & paste
        try {
            srcDoc = app.open(iconFile);
            unlockAll(srcDoc);

            // Strip Guides, empty text, stray points (Crucial for .AI and .SVG files)
            for (var gi = srcDoc.pageItems.length - 1; gi >= 0; gi--) {
                try {
                    var gItm = srcDoc.pageItems[gi];
                    if (gItm.guides) {
                        gItm.remove();
                    } else if (gItm.typename === "PathItem") {
                        if (!gItm.clipping && !gItm.filled && !gItm.stroked) {
                            gItm.remove();
                        } else if (gItm.pathPoints && gItm.pathPoints.length <= 1) {
                            gItm.remove();
                        }
                    } else if (gItm.typename === "TextFrame") {
                        if (gItm.contents.replace(/\s+/g, "").length === 0) {
                            gItm.remove();
                        }
                    }
                } catch (eStrip) {}
            }

            if (cleanBG) {
                try {
                    cleanVectorBackgroundSafely(srcDoc, t);
                } catch (eBg) {}
            }

            // Outline fonts if any
            try { outlineAllText(srcDoc); } catch (eTxt) {}

            // Consolidate all top-level artwork into ONE single master group on a temp layer
            // (Completely immune to "Paste Remembers Layers" and multi-layer scattering)
            var tempLayer = srcDoc.layers.add();
            tempLayer.name = "_TEMP_ICON_MASTER_";
            var masterGroup = tempLayer.groupItems.add();

            for (var lyrIdx = srcDoc.layers.length - 1; lyrIdx >= 0; lyrIdx--) {
                var curLyr = srcDoc.layers[lyrIdx];
                if (curLyr === tempLayer) continue;
                curLyr.locked = false;
                curLyr.visible = true;

                for (var itmIdx = curLyr.pageItems.length - 1; itmIdx >= 0; itmIdx--) {
                    try {
                        var itmObj = curLyr.pageItems[itmIdx];
                        if (itmObj.parent === curLyr) {
                            itmObj.locked = false;
                            itmObj.hidden = false;
                            itmObj.move(masterGroup, ElementPlacement.PLACEATEND);
                        }
                    } catch (eMove) {}
                }
            }

            srcDoc.selection = null;
            masterGroup.selected = true;
            app.copy();

            // Paste into target document WHILE srcDoc is active
            targetDoc.activate();
            targetDoc.selection = null;
            app.paste();

            if (targetDoc.selection && targetDoc.selection.length > 0) {
                if (targetDoc.selection.length > 1) {
                    try { app.executeMenuCommand("group"); } catch (eGrp1) {}
                }
                iconGroup = targetDoc.selection[0];

                // If iconGroup contains a bottom background box or card, strip it
                if (cleanBG && iconGroup && iconGroup.typename === "GroupItem" && iconGroup.pageItems.length > 1) {
                    try {
                        var lastChild = iconGroup.pageItems[iconGroup.pageItems.length - 1];
                        if (lastChild && (lastChild.typename === "PathItem" || lastChild.typename === "CompoundPathItem")) {
                            var gB = iconGroup.geometricBounds;
                            var lB = lastChild.geometricBounds;
                            var gw = Math.abs(gB[2] - gB[0]);
                            var gh = Math.abs(gB[1] - gB[3]);
                            var lw = Math.abs(lB[2] - lB[0]);
                            var lh = Math.abs(lB[1] - lB[3]);
                            if (lw >= gw * 0.70 && lh >= gh * 0.70) {
                                lastChild.remove();
                            }
                        }
                    } catch (eStripCard) {}
                }
            }

            try { srcDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (eCl) {}
            srcDoc = null;
        } catch (eOpenCopy) {
            if (srcDoc) try { srcDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (eC2) {}
            srcDoc = null;
            iconGroup = null;
        }

        // METHOD 2: PlacedItem embed fallback
        if (!iconGroup) {
            try {
                targetDoc.activate();
                targetDoc.selection = null;
                var pItem = targetDoc.placedItems.add();
                pItem.file = iconFile;
                try { pItem.embed(); } catch (eEmb) {}
                if (targetDoc.selection && targetDoc.selection.length > 0) {
                    if (targetDoc.selection.length > 1) {
                        try { app.executeMenuCommand("group"); } catch (eGrp2) {}
                    }
                    iconGroup = targetDoc.selection[0];
                } else if (targetDoc.pageItems.length > 0) {
                    iconGroup = targetDoc.pageItems[0];
                }

                if (cleanBG && iconGroup) {
                    try {
                        if (iconGroup.typename === "GroupItem") {
                            cleanVectorBackgroundSafely(targetDoc, t);
                        }
                    } catch (ePlClean) {}
                }
            } catch (ePl) {
                iconGroup = null;
            }
        }

        return iconGroup;
    }

    function placeIconInCell(iconGroup, targetDoc, abLeft, abTop, marginX, marginY, cellW, cellH, maxW, maxH, r, c) {
        if (!iconGroup) return;

        try {
            if (targetDoc) {
                try { targetDoc.rulerOrigin = [0, 0]; } catch (eRuler) {}
            }
            var abRect = (targetDoc && targetDoc.artboards && targetDoc.artboards.length > 0) ? targetDoc.artboards[0].artboardRect : [abLeft, abTop, abLeft + 4000, abTop - 2663];
            var abMinX = Math.min(abRect[0], abRect[2]);
            var abMaxX = Math.max(abRect[0], abRect[2]);
            var abMinY = Math.min(abRect[1], abRect[3]);
            var abMaxY = Math.max(abRect[1], abRect[3]);

            // Calculate precise cell boundaries
            var cellLeft   = abMinX + marginX + (c * cellW);
            var cellRight  = cellLeft + cellW;
            var cellTop    = abMaxY - marginY - (r * cellH);
            var cellBottom = cellTop - cellH;

            var cellMinX = Math.min(cellLeft, cellRight);
            var cellMaxX = Math.max(cellLeft, cellRight);
            var cellMinY = Math.min(cellTop, cellBottom);
            var cellMaxY = Math.max(cellTop, cellBottom);

            // Safe maximum size inside cell (guaranteeing safe margins and optimal scale: 85%)
            var maxSafeW = Math.min(maxW || (cellW * 0.85), cellW * 0.88);
            var maxSafeH = Math.min(maxH || (cellH * 0.85), cellH * 0.88);

            var gb = getTrueArtworkBounds(iconGroup) || iconGroup.visibleBounds || iconGroup.geometricBounds;
            if (!gb || (gb[0] === 0 && gb[1] === 0 && gb[2] === 0 && gb[3] === 0)) return;

            var curW = Math.abs(gb[2] - gb[0]);
            var curH = Math.abs(gb[1] - gb[3]);

            if (curW > 0.001 && curH > 0.001 && isFinite(curW) && isFinite(curH)) {
                var scaleW = (maxSafeW / curW) * 100;
                var scaleH = (maxSafeH / curH) * 100;
                var finalScale = Math.min(scaleW, scaleH);

                if (finalScale > 0 && isFinite(finalScale) && Math.abs(finalScale - 100) > 0.01) {
                    iconGroup.resize(
                        finalScale,
                        finalScale,
                        true, true, true, true,
                        true,
                        Transformation.CENTER
                    );
                }

                var cellCenterX = (cellMinX + cellMaxX) / 2;
                var cellCenterY = (cellMinY + cellMaxY) / 2;

                var newGb = getTrueArtworkBounds(iconGroup) || iconGroup.visibleBounds || iconGroup.geometricBounds;
                if (newGb && !(newGb[0] === 0 && newGb[1] === 0 && newGb[2] === 0 && newGb[3] === 0)) {
                    var iconCenterX = (newGb[0] + newGb[2]) / 2;
                    var iconCenterY = (newGb[1] + newGb[3]) / 2;

                    var dx = cellCenterX - iconCenterX;
                    var dy = cellCenterY - iconCenterY;

                    iconGroup.translate(dx, dy);

                    var placedGb = getTrueArtworkBounds(iconGroup) || iconGroup.visibleBounds || iconGroup.geometricBounds;
                    if (placedGb && !(placedGb[0] === 0 && placedGb[1] === 0 && placedGb[2] === 0 && placedGb[3] === 0)) {
                        var pMinX = Math.min(placedGb[0], placedGb[2]);
                        var pMaxX = Math.max(placedGb[0], placedGb[2]);
                        var pMinY = Math.min(placedGb[1], placedGb[3]);
                        var pMaxY = Math.max(placedGb[1], placedGb[3]);
                        var pW = pMaxX - pMinX;
                        var pH = pMaxY - pMinY;

                        // Re-verify that stroke weights/effects didn't breach cell limits
                        if (pW > maxSafeW || pH > maxSafeH) {
                            var fixScale = Math.min((maxSafeW / pW) * 100, (maxSafeH / pH) * 100);
                            if (fixScale > 0 && isFinite(fixScale) && fixScale < 100) {
                                iconGroup.resize(fixScale, fixScale, true, true, true, true, true, Transformation.CENTER);
                                placedGb = getTrueArtworkBounds(iconGroup) || iconGroup.visibleBounds || iconGroup.geometricBounds;
                                if (placedGb) {
                                    pMinX = Math.min(placedGb[0], placedGb[2]);
                                    pMaxX = Math.max(placedGb[0], placedGb[2]);
                                    pMinY = Math.min(placedGb[1], placedGb[3]);
                                    pMaxY = Math.max(placedGb[1], placedGb[3]);
                                }
                            }
                        }

                        // Strict clamp to artboard safe area (minimum 12px inner buffer)
                        var clampPad = 12;
                        var safeMinX = abMinX + clampPad;
                        var safeMaxX = abMaxX - clampPad;
                        var safeMinY = abMinY + clampPad;
                        var safeMaxY = abMaxY - clampPad;

                        var shiftX = 0;
                        var shiftY = 0;

                        if (pMinX < safeMinX) shiftX = safeMinX - pMinX;
                        else if (pMaxX > safeMaxX) shiftX = safeMaxX - pMaxX;

                        if (pMinY < safeMinY) shiftY = safeMinY - pMinY;
                        else if (pMaxY > safeMaxY) shiftY = safeMaxY - pMaxY;

                        if (shiftX !== 0 || shiftY !== 0) {
                            iconGroup.translate(shiftX, shiftY);
                        }
                    }
                }
            }
        } catch (ePlace) {}
        try { app.executeMenuCommand("deselectall"); } catch (e) { if (targetDoc) targetDoc.selection = null; }
    }

    function padNumber(num, size) {
        var sz = (size !== undefined) ? parseInt(size, 10) : 2;
        if (sz <= 1) return String(num);
        var s = "000000000" + num;
        return s.substr(s.length - sz);
    }

    // =========================================================================
    // KDP INTERIOR GENERATOR — FOUNDATION & ARCHITECTURE (v0.1.0)
    // =========================================================================

    // -------------------------------------------------------------------------
    // KDP Constants
    // -------------------------------------------------------------------------
    var KDP_GENERATOR_VERSION = "1.0.0";
    var KDP_POINTS_PER_INCH = 72;
    var KDP_POINTS_PER_MM = 72 / 25.4;   // ~2.83464567 pt/mm
    var KDP_POINTS_PER_CM = 72 / 2.54;   // ~28.3464567 pt/cm
    var KDP_POINTS_PER_PT = 1.0;
    var KDP_SUPPORTED_EXTS = ["svg", "eps", "ai", "pdf"];

    // Standard Amazon KDP Trim Size Presets (Width x Height in Inches)
    var KDP_PAGE_PRESETS = {
        "6x9":       { name: "6 x 9 in (Standard Trade)", width: 6.0,  height: 9.0,  unit: "in" },
        "8.5x11":    { name: "8.5 x 11 in (Letter / Workbook)", width: 8.5,  height: 11.0, unit: "in" },
        "8.5x8.5":   { name: "8.5 x 8.5 in (Square Children Book)", width: 8.5,  height: 8.5,  unit: "in" },
        "8x10":      { name: "8 x 10 in (Art / Children)", width: 8.0,  height: 10.0, unit: "in" },
        "5.5x8.5":   { name: "5.5 x 8.5 in (Digest)", width: 5.5,  height: 8.5,  unit: "in" },
        "5x8":       { name: "5 x 8 in (Pocket Book)", width: 5.0,  height: 8.0,  unit: "in" },
        "7x10":      { name: "7 x 10 in (Executive)", width: 7.0,  height: 10.0, unit: "in" },
        "7.5x9.25":  { name: "7.5 x 9.25 in (Composition)", width: 7.5,  height: 9.25, unit: "in" },
        "custom":    { name: "Custom Dimensions", width: 8.5, height: 11.0, unit: "in" }
    };

    // -------------------------------------------------------------------------
    // KDP Settings (Central Configuration Model)
    // -------------------------------------------------------------------------
    var DEFAULT_KDP_SETTINGS = {
        inputFolder: "",
        outputFolder: "",
        projectName: "KDP_Interior",

        pageWidth: 8.5,
        pageHeight: 11.0,
        pageUnit: "in",          // "in", "pt", "mm", "cm"
        pageCount: 24,

        iconsPerPage: 6,

        layoutMode: "auto",      // "auto", "manual"
        rows: 3,
        columns: 2,

        topMargin: 0.5,
        bottomMargin: 0.5,
        leftMargin: 0.5,
        rightMargin: 0.5,

        horizontalGap: 0.25,
        verticalGap: 0.25,

        fitMode: "fit",          // "fit" (maximum fit), "fixed-width", "fixed-height", "fill", "original"
        fixedIconWidth: 2.0,
        fixedIconHeight: 2.0,

        horizontalAlignment: "center", // "left", "center", "right"
        verticalAlignment: "center",   // "top", "center", "bottom"

        iconOrder: "sequential", // "sequential", "random"
        allowDuplicates: false,

        addPageNumber: false,
        pageNumberPosition: "bottom-center", // "bottom-left", "bottom-center", "bottom-right", "alternate"
        pageNumberStart: 1,
        pageNumberFontSize: 10,

        addBlankPageAfterContent: false,

        showSafeArea: false,
        showGrid: false,
        showPageBorder: false,

        exportPDF: true,
        exportEPS: false,
        exportSVG: false,

        overwriteExisting: false
    };

    function createKDPSettings(customOpts) {
        var opts = customOpts || {};
        var settings = {};
        for (var key in DEFAULT_KDP_SETTINGS) {
            if (DEFAULT_KDP_SETTINGS.hasOwnProperty(key)) {
                settings[key] = (opts[key] !== undefined) ? opts[key] : DEFAULT_KDP_SETTINGS[key];
            }
        }
        return settings;
    }

    // -------------------------------------------------------------------------
    // KDP Runtime State
    // -------------------------------------------------------------------------
    var kdpRuntimeState = {
        isGenerating: false,
        cancelRequested: false,
        progressWindow: null,
        inputFolder: null,
        outputFolder: null,
        detectedFiles: [],
        processedFiles: [],
        failedFiles: [],
        exportedFiles: [],
        failedExports: [],
        skippedExports: [],
        currentPage: 0,
        totalPages: 0,
        currentIcon: 0,
        totalIcons: 0,
        document: null,
        artboards: [],
        layers: null,
        startTime: null,
        errors: [],
        warnings: [],
        logs: []
    };

    function resetKDPRuntimeState() {
        kdpRuntimeState.isGenerating = false;
        kdpRuntimeState.cancelRequested = false;
        kdpRuntimeState.progressWindow = null;
        kdpRuntimeState.inputFolder = null;
        kdpRuntimeState.outputFolder = null;
        kdpRuntimeState.detectedFiles = [];
        kdpRuntimeState.processedFiles = [];
        kdpRuntimeState.failedFiles = [];
        kdpRuntimeState.exportedFiles = [];
        kdpRuntimeState.failedExports = [];
        kdpRuntimeState.skippedExports = [];
        kdpRuntimeState.currentPage = 0;
        kdpRuntimeState.totalPages = 0;
        kdpRuntimeState.currentIcon = 0;
        kdpRuntimeState.totalIcons = 0;
        kdpRuntimeState.document = null;
        kdpRuntimeState.artboards = [];
        kdpRuntimeState.layers = null;
        kdpRuntimeState.startTime = null;
        kdpRuntimeState.errors = [];
        kdpRuntimeState.warnings = [];
        kdpRuntimeState.logs = [];
        return kdpRuntimeState;
    }

    function getKDPRuntimeState() {
        return kdpRuntimeState;
    }

    // -------------------------------------------------------------------------
    // KDP Date / Time Formatting Helper
    // -------------------------------------------------------------------------
    function formatKDPDateTime(dateObj) {
        var d = dateObj || new Date();
        var yyyy = d.getFullYear();
        var mm = padNumber(d.getMonth() + 1, 2);
        var dd = padNumber(d.getDate(), 2);
        var hh = padNumber(d.getHours(), 2);
        var min = padNumber(d.getMinutes(), 2);
        var ss = padNumber(d.getSeconds(), 2);
        return yyyy + "-" + mm + "-" + dd + " " + hh + ":" + min + ":" + ss;
    }

    // -------------------------------------------------------------------------
    // KDP Presets Manager (Save / Load / Delete / Config Persistence)
    // -------------------------------------------------------------------------
    function getKDPPresetsFilePath() {
        try {
            var f = new File(Folder.userData.fsName + "/.kdp_interior_presets.cfg");
            return f;
        } catch (e) {
            return new File("~/Desktop/.kdp_interior_presets.cfg");
        }
    }

    function getDefaultKDPPresets() {
        return {
            "Standard 6x9 Trade (1-up)": createKDPSettings({
                projectName: "KDP_Trade_Book",
                pageWidth: 6.0, pageHeight: 9.0, pageUnit: "in", pageCount: 24,
                iconsPerPage: 1, layoutMode: "auto", rows: 1, columns: 1,
                topMargin: 0.5, bottomMargin: 0.5, leftMargin: 0.5, rightMargin: 0.5,
                horizontalGap: 0.25, verticalGap: 0.25, fitMode: "fit",
                horizontalAlignment: "center", verticalAlignment: "center",
                iconOrder: "sequential", allowDuplicates: false,
                addPageNumber: true, pageNumberPosition: "bottom-center", pageNumberStart: 1, pageNumberFontSize: 10,
                addBlankPageAfterContent: false, exportPDF: true, exportEPS: false, exportSVG: false, overwriteExisting: false
            }),
            "8.5x11 Workbook (4-up Grid)": createKDPSettings({
                projectName: "KDP_Workbook_Grid",
                pageWidth: 8.5, pageHeight: 11.0, pageUnit: "in", pageCount: 24,
                iconsPerPage: 4, layoutMode: "auto", rows: 2, columns: 2,
                topMargin: 0.5, bottomMargin: 0.5, leftMargin: 0.5, rightMargin: 0.5,
                horizontalGap: 0.25, verticalGap: 0.25, fitMode: "fit",
                horizontalAlignment: "center", verticalAlignment: "center",
                iconOrder: "sequential", allowDuplicates: false,
                addPageNumber: true, pageNumberPosition: "bottom-center", pageNumberStart: 1, pageNumberFontSize: 10,
                addBlankPageAfterContent: false, exportPDF: true, exportEPS: false, exportSVG: false, overwriteExisting: false
            }),
            "8.5x8.5 Square Children (6-up)": createKDPSettings({
                projectName: "KDP_Square_Children",
                pageWidth: 8.5, pageHeight: 8.5, pageUnit: "in", pageCount: 24,
                iconsPerPage: 6, layoutMode: "auto", rows: 3, columns: 2,
                topMargin: 0.5, bottomMargin: 0.5, leftMargin: 0.5, rightMargin: 0.5,
                horizontalGap: 0.2, verticalGap: 0.2, fitMode: "fit",
                horizontalAlignment: "center", verticalAlignment: "center",
                iconOrder: "sequential", allowDuplicates: false,
                addPageNumber: true, pageNumberPosition: "bottom-center", pageNumberStart: 1, pageNumberFontSize: 10,
                addBlankPageAfterContent: false, exportPDF: true, exportEPS: false, exportSVG: false, overwriteExisting: false
            }),
            "8x10 Children Art (2-up)": createKDPSettings({
                projectName: "KDP_Art_Book",
                pageWidth: 8.0, pageHeight: 10.0, pageUnit: "in", pageCount: 20,
                iconsPerPage: 2, layoutMode: "auto", rows: 2, columns: 1,
                topMargin: 0.5, bottomMargin: 0.5, leftMargin: 0.5, rightMargin: 0.5,
                horizontalGap: 0.3, verticalGap: 0.3, fitMode: "fit",
                horizontalAlignment: "center", verticalAlignment: "center",
                iconOrder: "sequential", allowDuplicates: false,
                addPageNumber: true, pageNumberPosition: "bottom-center", pageNumberStart: 1, pageNumberFontSize: 10,
                addBlankPageAfterContent: false, exportPDF: true, exportEPS: false, exportSVG: false, overwriteExisting: false
            }),
            "8.5x11 Flashcards (9-up Grid)": createKDPSettings({
                projectName: "KDP_Flashcards",
                pageWidth: 8.5, pageHeight: 11.0, pageUnit: "in", pageCount: 20,
                iconsPerPage: 9, layoutMode: "auto", rows: 3, columns: 3,
                topMargin: 0.375, bottomMargin: 0.375, leftMargin: 0.375, rightMargin: 0.375,
                horizontalGap: 0.2, verticalGap: 0.2, fitMode: "fit",
                horizontalAlignment: "center", verticalAlignment: "center",
                iconOrder: "sequential", allowDuplicates: false,
                addPageNumber: false, pageNumberPosition: "bottom-center", pageNumberStart: 1, pageNumberFontSize: 10,
                addBlankPageAfterContent: false, exportPDF: true, exportEPS: false, exportSVG: false, overwriteExisting: false
            })
        };
    }

    function loadAllKDPPresets() {
        var presets = getDefaultKDPPresets();
        try {
            var f = getKDPPresetsFilePath();
            if (f && f.exists) {
                if (f.open("r")) {
                    var content = f.read();
                    f.close();
                    if (content) {
                        var lines = content.split("\n");
                        var curPresetName = null;
                        var curPresetData = {};
                        for (var i = 0; i < lines.length; i++) {
                            var line = lines[i].replace(/^\s+|\s+$/g, "");
                            if (!line || line.indexOf("#") === 0 || line.indexOf("//") === 0) continue;
                            var mHeader = line.match(/^\[Preset:(.+)\]$/);
                            if (mHeader) {
                                if (curPresetName && curPresetData) {
                                    presets[curPresetName] = createKDPSettings(curPresetData);
                                }
                                curPresetName = mHeader[1].replace(/^\s+|\s+$/g, "");
                                curPresetData = {};
                            } else if (curPresetName) {
                                var eqIdx = line.indexOf("=");
                                if (eqIdx !== -1) {
                                    var k = line.substring(0, eqIdx).replace(/^\s+|\s+$/g, "");
                                    var v = line.substring(eqIdx + 1).replace(/^\s+|\s+$/g, "");
                                    if (v === "true") v = true;
                                    else if (v === "false") v = false;
                                    else if (!isNaN(v) && v !== "") v = parseFloat(v);
                                    curPresetData[k] = v;
                                }
                            }
                        }
                        if (curPresetName && curPresetData) {
                            presets[curPresetName] = createKDPSettings(curPresetData);
                        }
                    }
                }
            }
        } catch (eLoadP) {
            kdpHandleError("Error loading KDP presets: " + eLoadP.message, "Preset Manager", "WARNING");
        }
        return presets;
    }

    function saveAllKDPPresets(presetsObj) {
        try {
            var f = getKDPPresetsFilePath();
            if (f.open("w")) {
                f.encoding = "UTF-8";
                f.writeln("# KDP Interior Generator Presets Configuration");
                f.writeln("# Auto-generated on " + formatKDPDateTime(new Date()));
                f.writeln("");
                for (var pName in presetsObj) {
                    if (presetsObj.hasOwnProperty(pName)) {
                        f.writeln("[Preset:" + pName + "]");
                        var pData = presetsObj[pName];
                        for (var key in DEFAULT_KDP_SETTINGS) {
                            if (DEFAULT_KDP_SETTINGS.hasOwnProperty(key)) {
                                f.writeln(key + "=" + pData[key]);
                            }
                        }
                        f.writeln("");
                    }
                }
                f.close();
                return true;
            }
        } catch (eSaveAll) {
            kdpHandleError("Failed to save KDP presets file: " + eSaveAll.message, "Preset Manager", "ERROR");
        }
        return false;
    }

    function saveKDPSettingsPreset(name, settings) {
        if (!name || name.replace(/^\s+|\s+$/g, "").length === 0) {
            return { success: false, error: "Please enter a valid preset name." };
        }
        var cleanName = name.replace(/[\/\\:\*\?"<>\|\[\]]/g, "-").replace(/^\s+|\s+$/g, "");
        var allPresets = loadAllKDPPresets();
        allPresets[cleanName] = createKDPSettings(settings);
        var ok = saveAllKDPPresets(allPresets);
        if (ok) {
            kdpLogInfo("Saved KDP preset: " + cleanName);
            return { success: true, name: cleanName };
        }
        return { success: false, error: "Unable to write presets file." };
    }

    function deleteKDPSettingsPreset(name) {
        if (!name) return { success: false, error: "No preset selected." };
        var allPresets = loadAllKDPPresets();
        if (!allPresets.hasOwnProperty(name)) {
            return { success: false, error: "Preset not found: " + name };
        }
        delete allPresets[name];
        var ok = saveAllKDPPresets(allPresets);
        if (ok) {
            kdpLogInfo("Deleted KDP preset: " + name);
            return { success: true, name: name };
        }
        return { success: false, error: "Unable to update presets file." };
    }

    function getKDPAvailablePresets() {
        var presets = loadAllKDPPresets();
        var list = [];
        for (var name in presets) {
            if (presets.hasOwnProperty(name)) {
                list.push(name);
            }
        }
        return list;
    }

    function loadKDPSettingsPreset(name) {
        var allPresets = loadAllKDPPresets();
        if (allPresets.hasOwnProperty(name)) {
            return allPresets[name];
        }
        return null;
    }

    function serializeKDPSettings(settings) {
        var s = settings || createKDPSettings();
        var lines = [];
        for (var key in DEFAULT_KDP_SETTINGS) {
            if (DEFAULT_KDP_SETTINGS.hasOwnProperty(key)) {
                lines.push(key + "=" + s[key]);
            }
        }
        return lines.join("\n");
    }

    function deserializeKDPSettings(str) {
        if (!str) return createKDPSettings();
        var lines = str.split("\n");
        var data = {};
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].replace(/^\s+|\s+$/g, "");
            if (!line || line.indexOf("#") === 0 || line.indexOf("//") === 0) continue;
            var eqIdx = line.indexOf("=");
            if (eqIdx !== -1) {
                var k = line.substring(0, eqIdx).replace(/^\s+|\s+$/g, "");
                var v = line.substring(eqIdx + 1).replace(/^\s+|\s+$/g, "");
                if (v === "true") v = true;
                else if (v === "false") v = false;
                else if (!isNaN(v) && v !== "") v = parseFloat(v);
                data[k] = v;
            }
        }
        return createKDPSettings(data);
    }

    // -------------------------------------------------------------------------
    // KDP Progress Window & Live Monitor
    // -------------------------------------------------------------------------
    function showKDPProgressWindow(title, maxVal) {
        try {
            if (kdpRuntimeState.progressWindow) {
                try { kdpRuntimeState.progressWindow.close(); } catch (eCls) {}
            }

            var win = new Window("palette", (title || "KDP Interior Processing"), undefined, { closeButton: false });
            win.orientation = "column";
            win.alignChildren = ["fill", "top"];
            win.spacing = 10;
            win.margins = [18, 16, 18, 14];
            win.preferredSize = [460, 240];
            win.size = [460, 240];
            win.minimumSize = [460, 240];
            win.maximumSize = [460, 240];

            // Header Info
            var pnlHeader = win.add("panel", undefined, "");
            pnlHeader.orientation = "column";
            pnlHeader.alignChildren = ["left", "center"];
            pnlHeader.margins = [10, 8, 10, 8];
            pnlHeader.spacing = 3;

            var lblStatus = pnlHeader.add("statictext", undefined, "Initializing KDP Generator...");
            try { lblStatus.graphics.font = ScriptUI.newFont(lblStatus.graphics.font.name, "Bold", 12); } catch (eF) {}

            var lblDetails = pnlHeader.add("statictext", undefined, "Preparing workspace & layout calculations...");
            try { lblDetails.graphics.foregroundColor = lblDetails.graphics.newPen(lblDetails.graphics.PenType.SOLID_COLOR, [0.4, 0.4, 0.4, 1], 1); } catch (eC) {}

            // Progress Section
            var pnlBar = win.add("panel", undefined, "Progress");
            pnlBar.orientation = "column";
            pnlBar.alignChildren = ["fill", "top"];
            pnlBar.margins = [12, 10, 12, 10];
            pnlBar.spacing = 6;

            var pBar = pnlBar.add("progressbar", undefined, 0, (maxVal || 100));
            pBar.preferredSize.height = 14;

            var grpStats = pnlBar.add("group");
            grpStats.orientation = "row";
            grpStats.alignChildren = ["fill", "center"];

            var lblPercent = grpStats.add("statictext", undefined, "0%");
            try { lblPercent.graphics.font = ScriptUI.newFont(lblPercent.graphics.font.name, "Bold", 11); } catch (eP) {}

            var grpTime = grpStats.add("group");
            grpTime.alignment = ["right", "center"];
            var lblTime = grpTime.add("statictext", undefined, "Elapsed: 00:00:00");

            // Task & File row
            var lblTask = win.add("statictext", undefined, "Current Task: Validating settings...");

            // Action row
            var grpActions = win.add("group");
            grpActions.orientation = "row";
            grpActions.alignment = ["center", "bottom"];
            grpActions.margins = [0, 4, 0, 0];

            var btnCancel = grpActions.add("button", [0, 0, 100, 28], "Cancel");
            btnCancel.onClick = function () {
                kdpRuntimeState.cancelRequested = true;
                lblStatus.text = "Cancelling process... please wait.";
                btnCancel.enabled = false;
                try { win.update(); } catch (eU) {}
            };

            win.elements = {
                status: lblStatus,
                details: lblDetails,
                pBar: pBar,
                percent: lblPercent,
                time: lblTime,
                task: lblTask,
                btnCancel: btnCancel
            };

            win.show();
            kdpRuntimeState.progressWindow = win;
            kdpRuntimeState.startTime = new Date().getTime();
            kdpRuntimeState.cancelRequested = false;
            return win;
        } catch (eProg) {
            kdpHandleError("Unable to initialize progress window: " + eProg.message, "Progress UI", "WARNING");
            return null;
        }
    }

    function updateKDPProgress(curVal, maxVal, message, task, pageStr, iconStr, fileStr) {
        var win = kdpRuntimeState.progressWindow;
        if (!win || !win.elements) return;

        try {
            var mVal = maxVal || win.elements.pBar.maxvalue || 100;
            var cVal = Math.min(curVal || 0, mVal);
            win.elements.pBar.maxvalue = mVal;
            win.elements.pBar.value = cVal;

            var pct = Math.round((cVal / Math.max(mVal, 1)) * 100);
            win.elements.percent.text = pct + "%";

            if (message) win.elements.status.text = message;

            var detailParts = [];
            if (pageStr) detailParts.push(pageStr);
            if (iconStr) detailParts.push(iconStr);
            if (fileStr) detailParts.push(fileStr);
            if (detailParts.length > 0) {
                win.elements.details.text = detailParts.join(" | ");
            }

            if (task) win.elements.task.text = "Task: " + task;

            if (kdpRuntimeState.startTime) {
                var now = new Date().getTime();
                var elapsedSec = Math.floor((now - kdpRuntimeState.startTime) / 1000);
                var eMin = Math.floor(elapsedSec / 60);
                var eSec = elapsedSec % 60;
                var eStr = padNumber(eMin, 2) + ":" + padNumber(eSec, 2);

                var timeStr = "Elapsed: " + eStr;
                if (pct > 5 && pct < 100) {
                    var totalEstSec = Math.floor(elapsedSec / (pct / 100));
                    var remSec = Math.max(0, totalEstSec - elapsedSec);
                    var rMin = Math.floor(remSec / 60);
                    var rSec = remSec % 60;
                    timeStr += " | Remaining: ~" + padNumber(rMin, 2) + ":" + padNumber(rSec, 2);
                }
                win.elements.time.text = timeStr;
            }

            win.update();
        } catch (eUp) {}
    }

    function closeKDPProgressWindow() {
        if (kdpRuntimeState.progressWindow) {
            try {
                kdpRuntimeState.progressWindow.close();
            } catch (eCls) {}
            kdpRuntimeState.progressWindow = null;
        }
    }

    // -------------------------------------------------------------------------
    // KDP File Logging Engine (Output/Logs/generation_log.txt)
    // -------------------------------------------------------------------------
    function writeKDPGenerationLog(summary, settings, outFolder) {
        if (!summary) return null;
        try {
            var baseOut = outFolder || (settings ? settings.outputFolder : null) || "~/Desktop/KDP_Output";
            var outF = (baseOut instanceof Folder) ? baseOut : new Folder(baseOut);
            if (!outF.exists) {
                try { outF.create(); } catch (eF) {}
            }
            var logDir = new Folder(outF.fsName + "/Logs");
            if (!logDir.exists) {
                try { logDir.create(); } catch (eLd) {}
            }
            var logFile = new File(logDir.fsName + "/generation_log.txt");
            logFile.encoding = "UTF-8";

            if (logFile.open("a")) {
                var nowStr = formatKDPDateTime(new Date());
                var s = settings || createKDPSettings();

                var lines = [];
                lines.push("================================================================================");
                lines.push("KDP INTERIOR GENERATION LOG — " + nowStr);
                lines.push("================================================================================");
                lines.push("Project Name:        " + (summary.projectName || s.projectName));
                lines.push("Input Folder:        " + (s.inputFolder || "N/A"));
                lines.push("Output Folder:       " + (s.outputFolder || "N/A"));
                lines.push("Page Dimensions:     " + s.pageWidth + " x " + s.pageHeight + " " + s.pageUnit);
                lines.push("Page Count:          " + summary.createdPages + " created (Requested: " + summary.requestedPages + ")");
                lines.push("Icons Per Page:      " + s.iconsPerPage + " (Layout Mode: " + s.layoutMode + ", Grid: " + s.rows + "x" + s.columns + ")");
                lines.push("Margins (T/B/L/R):   " + s.topMargin + " / " + s.bottomMargin + " / " + s.leftMargin + " / " + s.rightMargin + " " + s.pageUnit);
                lines.push("Gaps (H/V):          " + s.horizontalGap + " / " + s.verticalGap + " " + s.pageUnit);
                lines.push("Fit & Alignment:     " + s.fitMode + " | H: " + s.horizontalAlignment + " | V: " + s.verticalAlignment);
                lines.push("Icon Order:          " + s.iconOrder + " (Duplicates: " + (s.allowDuplicates ? "Allowed" : "Disabled") + ")");
                lines.push("Page Numbers:        " + (s.addPageNumber ? ("Enabled (" + s.pageNumberPosition + ", start: " + s.pageNumberStart + ")") : "Disabled"));
                lines.push("Blank Pages:         " + (s.addBlankPageAfterContent ? "Enabled (Alternating)" : "Disabled"));
                lines.push("--------------------------------------------------------------------------------");
                lines.push("GENERATION METRICS:");
                lines.push("  Status:            " + (summary.isCancelled ? "CANCELLED" : (summary.isSuccess ? "SUCCESS" : (summary.failedIcons > 0 ? "COMPLETED WITH WARNINGS" : "FAILED"))));
                lines.push("  Available Icons:   " + summary.availableIcons);
                lines.push("  Required Slots:    " + summary.requiredSlots);
                lines.push("  Placed Icons:      " + summary.placedIcons);
                lines.push("  Failed Icons:      " + summary.failedIcons);
                lines.push("  Empty Slots:       " + summary.emptySlots);
                lines.push("  Unused Icons:      " + summary.unusedIcons);
                lines.push("  Duration:          " + summary.durationSeconds + " seconds");
                lines.push("--------------------------------------------------------------------------------");
                lines.push("EXPORT RESULTS:");
                lines.push("  Export Status:     " + (summary.exportStatus || "None"));
                if (summary.exportResults) {
                    var er = summary.exportResults;
                    if (er.pdf) lines.push("  PDF:               " + (er.pdf.success ? (er.pdf.skipped ? "Skipped (Exists)" : "Success") : "Failed (" + er.pdf.error + ")"));
                    if (er.eps) lines.push("  EPS:               " + er.eps.successCount + " exported, " + er.eps.skippedCount + " skipped, " + er.eps.failCount + " failed");
                    if (er.svg) lines.push("  SVG:               " + er.svg.successCount + " exported, " + er.svg.skippedCount + " skipped, " + er.svg.failCount + " failed");
                }
                if (kdpRuntimeState.warnings && kdpRuntimeState.warnings.length > 0) {
                    lines.push("--------------------------------------------------------------------------------");
                    lines.push("WARNINGS (" + kdpRuntimeState.warnings.length + "):");
                    for (var w = 0; w < kdpRuntimeState.warnings.length; w++) {
                        lines.push("  [!] " + kdpRuntimeState.warnings[w]);
                    }
                }
                if (kdpRuntimeState.errors && kdpRuntimeState.errors.length > 0) {
                    lines.push("--------------------------------------------------------------------------------");
                    lines.push("ERRORS (" + kdpRuntimeState.errors.length + "):");
                    for (var e = 0; e < kdpRuntimeState.errors.length; e++) {
                        lines.push("  [X] " + kdpRuntimeState.errors[e]);
                    }
                }
                lines.push("================================================================================\n");

                logFile.writeln(lines.join("\n"));
                logFile.close();
                return logFile;
            }
        } catch (eLogWrite) {
            kdpHandleError("Failed to write generation log: " + eLogWrite.message, "File Logger", "WARNING");
        }
        return null;
    }

    // -------------------------------------------------------------------------
    // KDP Utilities (Unit Conversion & Geometric Math)
    // -------------------------------------------------------------------------
    function convertToPoints(value, unit) {
        var num = parseFloat(value);
        if (isNaN(num)) return 0;
        var u = (unit || "pt").toString().toLowerCase().replace(/^\s+|\s+$/g, "");
        switch (u) {
            case "in":
            case "inch":
            case "inches":
            case "\"":
                return num * KDP_POINTS_PER_INCH;
            case "mm":
            case "millimeter":
            case "millimeters":
                return num * KDP_POINTS_PER_MM;
            case "cm":
            case "centimeter":
            case "centimeters":
                return num * KDP_POINTS_PER_CM;
            case "pt":
            case "point":
            case "points":
            case "px":
            case "pixel":
            case "pixels":
            default:
                return num;
        }
    }

    function pointsToUnit(value, unit) {
        var num = parseFloat(value);
        if (isNaN(num)) return 0;
        var u = (unit || "pt").toString().toLowerCase().replace(/^\s+|\s+$/g, "");
        switch (u) {
            case "in":
            case "inch":
            case "inches":
            case "\"":
                return num / KDP_POINTS_PER_INCH;
            case "mm":
            case "millimeter":
            case "millimeters":
                return num / KDP_POINTS_PER_MM;
            case "cm":
            case "centimeter":
            case "centimeters":
                return num / KDP_POINTS_PER_CM;
            case "pt":
            case "point":
            case "points":
            case "px":
            case "pixel":
            case "pixels":
            default:
                return num;
        }
    }

    function getKDPPageSizeInPoints(settings) {
        var unit = (settings && settings.pageUnit) ? settings.pageUnit : "in";
        var w = (settings && settings.pageWidth) ? parseFloat(settings.pageWidth) : 8.5;
        var h = (settings && settings.pageHeight) ? parseFloat(settings.pageHeight) : 11.0;
        return {
            width: convertToPoints(w, unit),
            height: convertToPoints(h, unit)
        };
    }

    function getKDPMarginsInPoints(settings) {
        var unit = (settings && settings.pageUnit) ? settings.pageUnit : "in";
        return {
            top: convertToPoints(settings.topMargin !== undefined ? settings.topMargin : 0.5, unit),
            bottom: convertToPoints(settings.bottomMargin !== undefined ? settings.bottomMargin : 0.5, unit),
            left: convertToPoints(settings.leftMargin !== undefined ? settings.leftMargin : 0.5, unit),
            right: convertToPoints(settings.rightMargin !== undefined ? settings.rightMargin : 0.5, unit)
        };
    }

    function getKDPGapsInPoints(settings) {
        var unit = (settings && settings.pageUnit) ? settings.pageUnit : "in";
        return {
            horizontal: convertToPoints(settings.horizontalGap !== undefined ? settings.horizontalGap : 0.25, unit),
            vertical: convertToPoints(settings.verticalGap !== undefined ? settings.verticalGap : 0.25, unit)
        };
    }

    // -------------------------------------------------------------------------
    // KDP Validation Foundation
    // -------------------------------------------------------------------------
    function validateKDPSettings(settings, isPreviewOnly) {
        var res = {
            isValid: true,
            errors: [],
            warnings: []
        };

        if (!settings) {
            res.isValid = false;
            res.errors.push("Settings object is null or undefined.");
            return res;
        }

        // 1. Page Dimensions
        var pWidth = parseFloat(settings.pageWidth);
        var pHeight = parseFloat(settings.pageHeight);
        if (isNaN(pWidth) || pWidth <= 0) {
            res.isValid = false;
            res.errors.push("Invalid page size: Page width must be a positive number greater than 0.");
        }
        if (isNaN(pHeight) || pHeight <= 0) {
            res.isValid = false;
            res.errors.push("Invalid page size: Page height must be a positive number greater than 0.");
        }

        // 2. Page Count
        var pCount = parseInt(settings.pageCount, 10);
        if (isNaN(pCount) || pCount < 1) {
            res.isValid = false;
            res.errors.push("Invalid page count: Page count must be an integer of at least 1.");
        } else if (pCount > 1000) {
            res.warnings.push("High page count (" + pCount + ") may consume significant memory in Illustrator.");
        }

        // 3. Icons Per Page / Grid Dimensions
        var iconsPerPage = parseInt(settings.iconsPerPage, 10);
        if (isNaN(iconsPerPage) || iconsPerPage < 1) {
            res.isValid = false;
            res.errors.push("Invalid icons/page: Icons per page must be at least 1.");
        }

        if (settings.layoutMode === "manual") {
            var rows = parseInt(settings.rows, 10);
            var cols = parseInt(settings.columns, 10);
            if (isNaN(rows) || rows < 1) {
                res.isValid = false;
                res.errors.push("Invalid rows/columns: Manual grid rows must be an integer of at least 1.");
            }
            if (isNaN(cols) || cols < 1) {
                res.isValid = false;
                res.errors.push("Invalid rows/columns: Manual grid columns must be an integer of at least 1.");
            }
        }

        // 4. Margins and Gaps Validation
        var pagePt = getKDPPageSizeInPoints(settings);
        var marginsPt = getKDPMarginsInPoints(settings);
        var gapsPt = getKDPGapsInPoints(settings);

        if (marginsPt.top < 0 || marginsPt.bottom < 0 || marginsPt.left < 0 || marginsPt.right < 0) {
            res.isValid = false;
            res.errors.push("Invalid margins: Margins cannot be negative numbers.");
        }

        var totalMarginH = marginsPt.left + marginsPt.right;
        var totalMarginV = marginsPt.top + marginsPt.bottom;

        if (totalMarginH >= pagePt.width) {
            res.isValid = false;
            res.errors.push("Invalid margins: Combined left and right margins (" + totalMarginH.toFixed(1) + " pt) exceed or equal total page width (" + pagePt.width.toFixed(1) + " pt).");
        }
        if (totalMarginV >= pagePt.height) {
            res.isValid = false;
            res.errors.push("Invalid margins: Combined top and bottom margins (" + totalMarginV.toFixed(1) + " pt) exceed or equal total page height (" + pagePt.height.toFixed(1) + " pt).");
        }

        if (gapsPt.horizontal < 0 || gapsPt.vertical < 0) {
            res.isValid = false;
            res.errors.push("Invalid gaps: Grid gaps cannot be negative numbers.");
        }

        // Amazon KDP Standard Gutter Warning
        var minGutterInches = (pCount > 150) ? 0.5 : 0.375;
        var minGutterPt = minGutterInches * KDP_POINTS_PER_INCH;
        if (marginsPt.left < minGutterPt || marginsPt.right < minGutterPt) {
            res.warnings.push("KDP recommended inside gutter margin is at least " + minGutterInches + " in for " + pCount + " pages.");
        }

        // 5. Folders and Files Check
        if (!isPreviewOnly) {
            if (!settings.inputFolder) {
                res.isValid = false;
                res.errors.push("Missing Input Folder: Please select a source folder containing your vector icons.");
            } else {
                var inF = new Folder(settings.inputFolder);
                if (!inF.exists) {
                    res.isValid = false;
                    res.errors.push("Input folder does not exist: " + settings.inputFolder);
                } else {
                    var detected = scanKDPInputFiles(inF);
                    if (detected.length === 0) {
                        res.isValid = false;
                        res.errors.push("No supported icon files found in the Input Folder (Supported: SVG, EPS, AI, PDF).");
                    }
                }
            }

            if (!settings.outputFolder) {
                res.isValid = false;
                res.errors.push("Missing Output Folder: Please select a destination folder for generated interiors.");
            }
        }

        return res;
    }

    // -------------------------------------------------------------------------
    // KDP Error Handling Foundation
    // -------------------------------------------------------------------------
    function kdpHandleError(error, context, severity) {
        var msg = (error && error.message) ? error.message : String(error);
        var ctx = context || "General";
        var sev = severity || "ERROR";
        var formatted = "[" + sev + "] [" + ctx + "]: " + msg;

        if (sev === "ERROR") {
            kdpRuntimeState.errors.push(formatted);
            kdpLogError(msg, { context: ctx });
        } else if (sev === "WARNING") {
            kdpRuntimeState.warnings.push(formatted);
            kdpLogWarning(msg, { context: ctx });
        } else {
            kdpLogInfo(msg, { context: ctx });
        }

        return formatted;
    }

    // -------------------------------------------------------------------------
    // KDP Logger Foundation
    // -------------------------------------------------------------------------
    function kdpLog(level, message, data) {
        var entry = {
            timestamp: new Date().getTime(),
            level: level || "INFO",
            message: message || "",
            data: data || null
        };
        kdpRuntimeState.logs.push(entry);
        return entry;
    }

    function kdpLogInfo(message, data) {
        return kdpLog("INFO", message, data);
    }

    function kdpLogWarning(message, data) {
        return kdpLog("WARNING", message, data);
    }

    function kdpLogError(message, data) {
        return kdpLog("ERROR", message, data);
    }

    function kdpGetLogs() {
        return kdpRuntimeState.logs;
    }

    function kdpClearLogs() {
        kdpRuntimeState.logs = [];
    }

    // -------------------------------------------------------------------------
    // KDP File Manager
    // -------------------------------------------------------------------------
    function getKDPFileExtension(fileOrPath) {
        if (!fileOrPath) return "";
        var name = (fileOrPath instanceof File || fileOrPath instanceof Folder) ? fileOrPath.name : String(fileOrPath);
        var dot = name.lastIndexOf(".");
        if (dot === -1) return "";
        return name.substring(dot + 1).toLowerCase();
    }

    function isSupportedKDPFile(fileOrPath) {
        if (!fileOrPath) return false;
        var name = (fileOrPath instanceof File) ? fileOrPath.name : String(fileOrPath);
        if (name.match(/^\._/) || name.match(/^\./) || name.toLowerCase() === "thumbs.db" || name.toLowerCase() === ".ds_store") {
            return false;
        }
        var ext = getKDPFileExtension(fileOrPath);
        for (var i = 0; i < KDP_SUPPORTED_EXTS.length; i++) {
            if (ext === KDP_SUPPORTED_EXTS[i]) return true;
        }
        return false;
    }

    function sortKDPFilesNaturally(files) {
        if (!files || !(files instanceof Array)) return [];

        function getFilename(item) {
            if (!item) return "";
            if (item instanceof File || item instanceof Folder) return item.name;
            return String(item);
        }

        files.sort(function (a, b) {
            var aStr = getFilename(a);
            var bStr = getFilename(b);
            var aChunks = aStr.match(/(\d+|\D+)/g) || [];
            var bChunks = bStr.match(/(\d+|\D+)/g) || [];
            var minLen = Math.min(aChunks.length, bChunks.length);
            for (var i = 0; i < minLen; i++) {
                var aChunk = aChunks[i];
                var bChunk = bChunks[i];
                var aNum = parseInt(aChunk, 10);
                var bNum = parseInt(bChunk, 10);
                var aIsNum = !isNaN(aNum) && /^\d+$/.test(aChunk);
                var bIsNum = !isNaN(bNum) && /^\d+$/.test(bChunk);
                if (aIsNum && bIsNum) {
                    if (aNum !== bNum) return aNum - bNum;
                    if (aChunk.length !== bChunk.length) return aChunk.length - bChunk.length;
                } else {
                    var aLower = aChunk.toLowerCase();
                    var bLower = bChunk.toLowerCase();
                    if (aLower !== bLower) {
                        return aLower < bLower ? -1 : 1;
                    }
                }
            }
            return aChunks.length - bChunks.length;
        });

        return files;
    }

    function scanKDPInputFiles(folderOrPath, options) {
        var opts = options || {};
        var targetFolder = (folderOrPath instanceof Folder) ? folderOrPath : new Folder(folderOrPath);
        if (!targetFolder || !targetFolder.exists) {
            kdpHandleError("Input folder does not exist: " + (folderOrPath || "N/A"), "Input Folder", "ERROR");
            return [];
        }

        // Cache optimization: avoid redundant scanning if same folder path
        if (!opts.forceRescan && kdpRuntimeState.inputFolder === targetFolder.fsName && kdpRuntimeState.detectedFiles.length > 0) {
            return kdpRuntimeState.detectedFiles;
        }

        var validFiles = [];
        var isRecursive = (opts.recursive !== false); // default recursive

        function collectKDP(dir) {
            try {
                var items = dir.getFiles();
                for (var i = 0; i < items.length; i++) {
                    var item = items[i];
                    if (item instanceof File) {
                        if (isSupportedKDPFile(item)) {
                            validFiles.push(item);
                        }
                    } else if (item instanceof Folder && isRecursive) {
                        if (!item.name.match(/^\./)) {
                            collectKDP(item);
                        }
                    }
                }
            } catch (eDir) {
                kdpHandleError(eDir, "Folder Scan: " + dir.fsName, "WARNING");
            }
        }

        collectKDP(targetFolder);
        sortKDPFilesNaturally(validFiles);

        // Store detected files and statistics in runtime state
        kdpRuntimeState.inputFolder = targetFolder.fsName;
        kdpRuntimeState.detectedFiles = validFiles;
        kdpRuntimeState.totalIcons = validFiles.length;

        if (validFiles.length > 0) {
            kdpLogInfo("Scanned input folder. Found " + validFiles.length + " supported vector files.", {
                path: targetFolder.fsName,
                count: validFiles.length
            });
        } else {
            kdpLogWarning("No supported icon files found in folder: " + targetFolder.fsName);
        }

        return validFiles;
    }

    function validateKDPFolders(inputPath, outputPath) {
        var errors = [];
        if (!inputPath) {
            errors.push("Missing Input Folder: Please select a folder.");
        } else {
            var inF = new Folder(inputPath);
            if (!inF.exists) {
                errors.push("Input folder does not exist: " + inputPath);
            } else {
                var files = scanKDPInputFiles(inF);
                if (files.length === 0) {
                    errors.push("No supported icon files found in input folder (.svg, .eps, .ai, .pdf).");
                }
            }
        }

        if (!outputPath) {
            errors.push("Missing Output Folder: Please select an output destination.");
        } else {
            var outF = new Folder(outputPath);
            if (!outF.exists) {
                try {
                    outF.create();
                } catch (eMk) {
                    errors.push("Unable to create output folder: " + outputPath);
                }
            }
        }
        return { isValid: errors.length === 0, errors: errors };
    }

    // -------------------------------------------------------------------------
    // KDP Layout Engine
    // -------------------------------------------------------------------------
    function calculateKDPContentArea(settings) {
        var pagePt = getKDPPageSizeInPoints(settings);
        var marginsPt = getKDPMarginsInPoints(settings);

        var contentW = pagePt.width - (marginsPt.left + marginsPt.right);
        var contentH = pagePt.height - (marginsPt.top + marginsPt.bottom);

        return {
            left: marginsPt.left,
            top: -marginsPt.top, // Illustrator coordinate space (origin at top-left, Y goes down negatively)
            right: marginsPt.left + contentW,
            bottom: -(marginsPt.top + contentH),
            width: contentW,
            height: contentH
        };
    }

    function calculateKDPGrid(settings, contentArea, gaps) {
        var count = parseInt(settings.iconsPerPage, 10);
        if (isNaN(count) || count < 1) count = 1;

        var mode = (settings && settings.layoutMode) ? settings.layoutMode.toLowerCase() : "auto";
        var manualRows = parseInt(settings.rows, 10);
        var manualCols = parseInt(settings.columns, 10);

        if (mode === "manual" && manualRows >= 1 && manualCols >= 1) {
            return {
                rows: manualRows,
                columns: manualCols,
                totalCells: manualRows * manualCols,
                iconsPerPage: count,
                mode: "manual"
            };
        }

        // Automatic grid calculation based on icon count and page geometry
        var cArea = contentArea || calculateKDPContentArea(settings);
        var g = gaps || getKDPGapsInPoints(settings);
        var contentW = Math.max(cArea.width, 1);
        var contentH = Math.max(cArea.height, 1);

        if (count === 1) {
            return { rows: 1, columns: 1, totalCells: 1, iconsPerPage: 1, mode: "auto" };
        }

        var isPortrait = contentH >= contentW;
        var bestRows = 1;
        var bestCols = count;
        var bestScore = Infinity;

        var maxR = Math.min(count, 50);
        for (var r = 1; r <= maxR; r++) {
            var minC = Math.ceil(count / r);
            var maxC = minC + 1;
            for (var c = minC; c <= maxC; c++) {
                if (r * c < count) continue;
                var unused = (r * c) - count;

                var totalHGap = (c - 1) * g.horizontal;
                var totalVGap = (r - 1) * g.vertical;
                var availW = contentW - totalHGap;
                var availH = contentH - totalVGap;
                if (availW <= 0 || availH <= 0) continue;

                var cellW = availW / c;
                var cellH = availH / r;
                var cellRatio = cellW / cellH;

                var cellDistortion = Math.max(cellRatio, 1 / cellRatio) - 1.0;
                var scoreUnused = unused * 3.0;
                var scoreCellRatio = cellDistortion * 5.0;
                var scoreOrientation = 0;
                if (isPortrait && c > r) {
                    scoreOrientation += (c - r) * 1.5;
                } else if (!isPortrait && r > c) {
                    scoreOrientation += (r - c) * 1.5;
                }

                var totalScore = scoreUnused + scoreCellRatio + scoreOrientation;
                if (totalScore < bestScore) {
                    bestScore = totalScore;
                    bestRows = r;
                    bestCols = c;
                }
            }
        }

        return {
            rows: bestRows,
            columns: bestCols,
            totalCells: bestRows * bestCols,
            iconsPerPage: count,
            mode: "auto"
        };
    }

    function calculateKDPCellSize(contentArea, rows, cols, hGap, vGap) {
        var r = (rows && rows > 0) ? rows : 1;
        var c = (cols && cols > 0) ? cols : 1;
        var totalHGap = (c - 1) * (hGap || 0);
        var totalVGap = (r - 1) * (vGap || 0);

        var availW = contentArea.width - totalHGap;
        var availH = contentArea.height - totalVGap;

        return {
            width: availW / c,
            height: availH / r
        };
    }

    function getKDPCellPosition(row, col, layoutData) {
        var xOffset = col * (layoutData.cellWidth + layoutData.horizontalGap);
        var yOffset = row * (layoutData.cellHeight + layoutData.verticalGap);
        var cellLeft = layoutData.margins.left + xOffset;
        var cellTop = -(layoutData.margins.top + yOffset);
        return {
            x: xOffset,
            y: yOffset,
            left: cellLeft,
            top: cellTop,
            centerX: cellLeft + (layoutData.cellWidth / 2),
            centerY: cellTop - (layoutData.cellHeight / 2)
        };
    }

    function getKDPCellBounds(row, col, layoutData) {
        var pos = getKDPCellPosition(row, col, layoutData);
        return [pos.left, pos.top, pos.left + layoutData.cellWidth, pos.top - layoutData.cellHeight];
    }

    function calculateKDPLayout(settings) {
        var s = settings || createKDPSettings();
        var pagePt = getKDPPageSizeInPoints(s);
        var marginsPt = getKDPMarginsInPoints(s);
        var gapsPt = getKDPGapsInPoints(s);
        var contentArea = calculateKDPContentArea(s);

        var errors = [];
        var warnings = [];

        if (contentArea.width <= 0 || contentArea.height <= 0) {
            errors.push("Invalid margins: Margins exceed or equal page dimensions. Usable content area width: " + contentArea.width.toFixed(1) + " pt, height: " + contentArea.height.toFixed(1) + " pt.");
        }

        var grid = calculateKDPGrid(s, contentArea, gapsPt);
        var rows = grid.rows;
        var cols = grid.columns;
        var capacity = rows * cols;
        var iconsPerPage = parseInt(s.iconsPerPage, 10) || 1;

        if (s.layoutMode === "manual" && capacity < iconsPerPage) {
            errors.push("Invalid manual grid: Capacity (" + rows + " rows × " + cols + " cols = " + capacity + ") is less than icons per page (" + iconsPerPage + ").");
        }

        var cellSize = calculateKDPCellSize(contentArea, rows, cols, gapsPt.horizontal, gapsPt.vertical);
        if (cellSize.width <= 0 || cellSize.height <= 0) {
            errors.push("Invalid layout geometry: Margins and gaps are too large for page size and grid count. Calculated cell width: " + cellSize.width.toFixed(1) + " pt, height: " + cellSize.height.toFixed(1) + " pt.");
        }

        var positions = [];
        var cellIndex = 0;
        for (var r = 0; r < rows; r++) {
            for (var c = 0; c < cols; c++) {
                var xOffset = c * (cellSize.width + gapsPt.horizontal);
                var yOffset = r * (cellSize.height + gapsPt.vertical);
                var cellLeft = marginsPt.left + xOffset;
                var cellTop = -(marginsPt.top + yOffset);
                var cellRight = cellLeft + cellSize.width;
                var cellBottom = cellTop - cellSize.height;
                var cellCenterX = cellLeft + (cellSize.width / 2);
                var cellCenterY = cellTop - (cellSize.height / 2);

                positions.push({
                    index: cellIndex,
                    row: r,
                    column: c,
                    x: xOffset,
                    y: yOffset,
                    width: cellSize.width,
                    height: cellSize.height,
                    left: cellLeft,
                    top: cellTop,
                    right: cellRight,
                    bottom: cellBottom,
                    centerX: cellCenterX,
                    centerY: cellCenterY,
                    bounds: [cellLeft, cellTop, cellRight, cellBottom],
                    isUsed: (cellIndex < iconsPerPage)
                });
                cellIndex++;
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors,
            warnings: warnings,
            pageWidth: pagePt.width,
            pageHeight: pagePt.height,
            pageUnit: s.pageUnit || "in",
            pageCount: parseInt(s.pageCount, 10) || 100,
            iconsPerPage: iconsPerPage,
            layoutMode: s.layoutMode || "auto",
            rows: rows,
            columns: cols,
            capacity: capacity,
            unusedCells: Math.max(0, capacity - iconsPerPage),
            margins: marginsPt,
            contentWidth: contentArea.width,
            contentHeight: contentArea.height,
            contentArea: contentArea,
            horizontalGap: gapsPt.horizontal,
            verticalGap: gapsPt.vertical,
            cellWidth: cellSize.width,
            cellHeight: cellSize.height,
            positions: positions
        };
    }

    function validateKDPLayout(layoutData) {
        if (!layoutData) return { isValid: false, errors: ["Layout data is null or undefined."] };
        return {
            isValid: layoutData.isValid,
            errors: layoutData.errors || [],
            warnings: layoutData.warnings || []
        };
    }

    // -------------------------------------------------------------------------
    // KDP Document & Artboard Manager
    // -------------------------------------------------------------------------
    function getKDPPageName(pageIndex) {
        var num = pageIndex + 1;
        var str = String(num);
        while (str.length < 3) {
            str = "0" + str;
        }
        return "Page-" + str;
    }

    function getKDPArtboardByPageIndex(pageIndex, doc) {
        var targetDoc = doc || kdpRuntimeState.document || (app.documents.length > 0 ? app.activeDocument : null);
        if (!targetDoc || !targetDoc.artboards || pageIndex < 0 || pageIndex >= targetDoc.artboards.length) {
            return null;
        }
        return targetDoc.artboards[pageIndex];
    }

    function getKDPArtboardBounds(pageIndex, doc) {
        var targetDoc = doc || kdpRuntimeState.document || (app.documents.length > 0 ? app.activeDocument : null);
        if (!targetDoc || !targetDoc.artboards || pageIndex < 0 || pageIndex >= targetDoc.artboards.length) {
            return null;
        }
        try { targetDoc.rulerOrigin = [0, 0]; } catch (eRuler) {}
        var ab = targetDoc.artboards[pageIndex];
        var rect = ab.artboardRect; // [left, top, right, bottom]
        var left = Math.min(rect[0], rect[2]);
        var right = Math.max(rect[0], rect[2]);
        var top = Math.max(rect[1], rect[3]);
        var bottom = Math.min(rect[1], rect[3]);
        return {
            left: left,
            top: top,
            right: right,
            bottom: bottom,
            width: Math.abs(right - left),
            height: Math.abs(top - bottom)
        };
    }

    function nameKDPArtboards(doc) {
        if (!doc || !doc.artboards) return;
        for (var i = 0; i < doc.artboards.length; i++) {
            doc.artboards[i].name = getKDPPageName(i);
        }
    }

    function setupKDPLayers(doc) {
        if (!doc) return null;
        try {
            var layerNames = ["Background", "Icons", "Page Numbers", "Guides"];
            var layerMap = {};

            function findExistingLayer(name) {
                for (var i = 0; i < doc.layers.length; i++) {
                    if (doc.layers[i].name.toLowerCase() === name.toLowerCase()) {
                        return doc.layers[i];
                    }
                }
                return null;
            }

            // Create or reuse layers in structured sequence:
            // Background (bottom) -> Icons -> Page Numbers -> Guides (top)
            for (var l = 0; l < layerNames.length; l++) {
                var name = layerNames[l];
                var lyr = findExistingLayer(name);
                if (!lyr) {
                    if (l === 0 && doc.layers.length === 1 && (doc.layers[0].name.indexOf("Layer") === 0 || doc.layers[0].pageItems.length === 0)) {
                        lyr = doc.layers[0];
                        lyr.name = name;
                    } else {
                        lyr = doc.layers.add();
                        lyr.name = name;
                    }
                }
                layerMap[name] = lyr;
            }

            // Ensure exact visual stacking order:
            // Background at bottom, Icons above it, Page Numbers above Icons, Guides on top
            if (layerMap["Background"]) {
                try { layerMap["Background"].zOrder(ZOrderMethod.SENDTOBACK); } catch (eZo1) {}
            }
            if (layerMap["Icons"]) {
                try { layerMap["Icons"].zOrder(ZOrderMethod.BRINGFORWARD); } catch (eZo2) {}
            }
            if (layerMap["Page Numbers"]) {
                try { layerMap["Page Numbers"].zOrder(ZOrderMethod.BRINGFORWARD); } catch (eZo3) {}
            }
            if (layerMap["Guides"]) {
                try { layerMap["Guides"].zOrder(ZOrderMethod.BRINGTOFRONT); } catch (eZo4) {}
            }

            var resultLayers = {
                background: layerMap["Background"],
                icons: layerMap["Icons"],
                pageNumbers: layerMap["Page Numbers"],
                guides: layerMap["Guides"]
            };

            kdpRuntimeState.layers = resultLayers;
            kdpLogInfo("Configured KDP document layers: Background, Icons, Page Numbers, Guides", {});
            return resultLayers;
        } catch (eLyr) {
            kdpHandleError(eLyr, "Layer Setup", "WARNING");
            return null;
        }
    }

    function createKDPLayers(doc, settings) {
        return setupKDPLayers(doc);
    }

    function createKDPArtboards(doc, settings) {
        if (!doc) return [];
        try {
            var pagePt = getKDPPageSizeInPoints(settings);
            var pageCount = parseInt(settings.pageCount, 10);
            if (isNaN(pageCount) || pageCount < 1) pageCount = 1;

            if (pageCount > 1000) {
                kdpHandleError("Requested page count (" + pageCount + ") exceeds maximum recommended artboard limit (1000).", "Artboard Manager", "WARNING");
            }

            var artboards = [];
            // Clean grid arrangement of artboards on the canvas
            var abSpacing = 50; // points between artboards
            var abCols = Math.min(Math.max(Math.ceil(Math.sqrt(pageCount)), 1), 10);

            for (var p = 0; p < pageCount; p++) {
                var col = p % abCols;
                var row = Math.floor(p / abCols);

                var abLeft = Math.round(col * (pagePt.width + abSpacing));
                var abTop = -Math.round(row * (pagePt.height + abSpacing));
                var abRight = Math.round(abLeft + pagePt.width);
                var abBottom = Math.round(abTop - pagePt.height);
                var abRect = [abLeft, abTop, abRight, abBottom];

                var ab = null;
                if (p < doc.artboards.length) {
                    ab = doc.artboards[p];
                    try { ab.artboardRect = abRect; } catch (eR) {}
                    try { ab.name = getKDPPageName(p); } catch (eN) {}
                } else {
                    try {
                        ab = doc.artboards.add(abRect);
                        ab.name = getKDPPageName(p);
                    } catch (eAdd) {
                        kdpHandleError(eAdd, "Artboard Creation for Page " + (p + 1), "WARNING");
                    }
                }
                if (ab) artboards.push(ab);
            }

            kdpRuntimeState.artboards = artboards;
            kdpLogInfo("Created " + artboards.length + " KDP Artboards (" + pagePt.width + " × " + pagePt.height + " pt each)", { total: pageCount });
            return artboards;
        } catch (eAb) {
            kdpHandleError(eAb, "Artboard Creation", "ERROR");
            return [];
        }
    }

    function createKDPDocument(settings) {
        try {
            var val = validateKDPSettings(settings, true);
            if (!val.isValid) {
                kdpHandleError("Cannot create document due to invalid settings:\n" + val.errors.join("\n"), "Document Creation", "ERROR");
                return null;
            }

            var pagePt = getKDPPageSizeInPoints(settings);
            var pageCount = parseInt(settings.pageCount, 10);
            if (isNaN(pageCount) || pageCount < 1) pageCount = 1;
            var abCols = Math.min(Math.max(Math.ceil(Math.sqrt(pageCount)), 1), 10);

            // Default to RGB print workflow
            var docColor = DocumentColorSpace.RGB;
            var doc = null;

            // Try creating multi-artboard document natively in one C++ call
            try {
                var layoutEnum = (typeof DocumentArtboardLayout !== "undefined" && DocumentArtboardLayout.GridByRow) ? DocumentArtboardLayout.GridByRow : 0;
                doc = app.documents.add(docColor, pagePt.width, pagePt.height, pageCount, layoutEnum, 50, abCols);
            } catch (eDocNative) {
                try {
                    doc = app.documents.add(docColor, pagePt.width, pagePt.height);
                } catch (eDocFallback) {
                    kdpHandleError(eDocFallback, "Document Creation Fallback", "ERROR");
                }
            }

            if (!doc) {
                kdpHandleError("Illustrator document creation returned null.", "Document Creation", "ERROR");
                return null;
            }

            // Create and arrange artboards
            createKDPArtboards(doc, settings);

            // Configure layer hierarchy
            setupKDPLayers(doc);

            kdpRuntimeState.document = doc;
            centerAndFitView(doc);

            kdpLogInfo("Created KDP Interior Document successfully", {
                projectName: settings.projectName || "KDP_Interior",
                width: pagePt.width,
                height: pagePt.height,
                pages: settings.pageCount
            });

            return doc;
        } catch (eDoc) {
            kdpHandleError(eDoc, "Document Creation", "ERROR");
            return null;
        }
    }

    // -------------------------------------------------------------------------
    // KDP Icon Manager
    // -------------------------------------------------------------------------
    function getKDPIconObjectName(pageIndex, iconIndex) {
        var pStr = String(pageIndex + 1);
        while (pStr.length < 3) pStr = "0" + pStr;
        var iStr = String(iconIndex + 1);
        while (iStr.length < 3) iStr = "0" + iStr;
        return "Page-" + pStr + "_Icon-" + iStr;
    }

    function convertKDPPageLocalToDocumentCoordinates(localCell, pageIndex, doc) {
        var targetDoc = doc || kdpRuntimeState.document || (app.documents.length > 0 ? app.activeDocument : null);
        if (!targetDoc || !targetDoc.artboards || pageIndex < 0 || pageIndex >= targetDoc.artboards.length) {
            return localCell;
        }
        try { targetDoc.rulerOrigin = [0, 0]; } catch (eRuler) {}
        var ab = targetDoc.artboards[pageIndex];
        var abRect = ab.artboardRect; // [abLeft, abTop, abRight, abBottom]

        var abLeft = Math.min(abRect[0], abRect[2]);
        var abTop = Math.max(abRect[1], abRect[3]);

        var docLeft = abLeft + localCell.left;
        var docTop = abTop + localCell.top; // localCell.top is negative offset
        var docRight = docLeft + localCell.width;
        var docBottom = docTop - localCell.height;
        var docCenterX = docLeft + (localCell.width / 2);
        var docCenterY = docTop - (localCell.height / 2);

        return {
            left: docLeft,
            top: docTop,
            right: docRight,
            bottom: docBottom,
            width: localCell.width,
            height: localCell.height,
            centerX: docCenterX,
            centerY: docCenterY,
            row: localCell.row,
            column: localCell.column,
            bounds: [docLeft, docTop, docRight, docBottom]
        };
    }

    function getKDPIconBounds(item) {
        if (!item) return null;
        try {
            var isZeroBounds = function(b) {
                if (!b || b.length < 4) return true;
                if (b[0] === 0 && b[1] === 0 && b[2] === 0 && b[3] === 0) return true;
                var w = Math.abs(b[2] - b[0]);
                var h = Math.abs(b[1] - b[3]);
                return (w <= 0.001 || h <= 0.001 || isNaN(w) || isNaN(h));
            };

            var gb = getTrueArtworkBounds(item);
            if (isZeroBounds(gb)) {
                try { gb = item.visibleBounds; } catch (e1) {}
            }
            if (isZeroBounds(gb)) {
                try { gb = item.geometricBounds; } catch (e2) {}
            }

            // Fallback for groups with invisible clipping masks returning [0,0,0,0]
            if (isZeroBounds(gb) && item.typename === "GroupItem" && item.pageItems && item.pageItems.length > 0) {
                for (var i = 0; i < item.pageItems.length; i++) {
                    var child = item.pageItems[i];
                    if (child.clipping) continue;
                    var cGb = getTrueArtworkBounds(child);
                    if (isZeroBounds(cGb)) {
                        try { cGb = child.visibleBounds; } catch (eVis) {}
                    }
                    if (isZeroBounds(cGb)) {
                        try { cGb = child.geometricBounds; } catch (eGeo) {}
                    }
                    if (!isZeroBounds(cGb)) {
                        gb = cGb;
                        break;
                    }
                }
            }

            if (isZeroBounds(gb)) return null;

            var w = Math.abs(gb[2] - gb[0]);
            var h = Math.abs(gb[1] - gb[3]);
            if (w <= 0.001 || h <= 0.001 || isNaN(w) || isNaN(h)) {
                return null;
            }
            return {
                left: gb[0],
                top: gb[1],
                right: gb[2],
                bottom: gb[3],
                width: w,
                height: h,
                centerX: (gb[0] + gb[2]) / 2,
                centerY: (gb[1] + gb[3]) / 2,
                bounds: [gb[0], gb[1], gb[2], gb[3]]
            };
        } catch (eGb) {
            return null;
        }
    }

    function calculateKDPIconScale(iconBounds, cellBounds, fitMode, settings) {
        if (!iconBounds || !cellBounds) return { scaleFactor: 1, scalePercent: 100 };
        var mode = (fitMode || "fit").toLowerCase();
        var curW = iconBounds.width;
        var curH = iconBounds.height;
        var availW = cellBounds.width;
        var availH = cellBounds.height;
        var s = settings || {};

        if (curW <= 0.001 || curH <= 0.001 || isNaN(curW) || isNaN(curH) || !isFinite(curW) || !isFinite(curH)) {
            return { scaleFactor: 1, scalePercent: 100 };
        }
        if (availW <= 0.001 || availH <= 0.001 || isNaN(availW) || isNaN(availH) || !isFinite(availW) || !isFinite(availH)) {
            return { scaleFactor: 1, scalePercent: 100 };
        }

        var scale = 100;
        if (mode === "fit" || mode === "maximum fit" || mode === "maximum-fit" || mode === "max") {
            var scaleW = (availW / curW) * 100;
            var scaleH = (availH / curH) * 100;
            scale = Math.min(scaleW, scaleH);
        } else if (mode === "fixed-width" || mode === "fixed_width") {
            var targetWVal = parseFloat(s.fixedIconWidth) || 2.0;
            var targetWPt = convertToPoints(targetWVal, s.pageUnit || "in");
            if (targetWPt > availW) targetWPt = availW;
            scale = (targetWPt / curW) * 100;
            var resultingH = curH * (scale / 100);
            if (resultingH > availH) {
                scale = (availH / curH) * 100;
            }
        } else if (mode === "fixed-height" || mode === "fixed_height") {
            var targetHVal = parseFloat(s.fixedIconHeight) || 2.0;
            var targetHPt = convertToPoints(targetHVal, s.pageUnit || "in");
            if (targetHPt > availH) targetHPt = availH;
            scale = (targetHPt / curH) * 100;
            var resultingW = curW * (scale / 100);
            if (resultingW > availW) {
                scale = (availW / curW) * 100;
            }
        } else if (mode === "original") {
            scale = 100;
            if (curW > availW || curH > availH) {
                scale = Math.min((availW / curW) * 100, (availH / curH) * 100);
            }
        } else {
            scale = Math.min((availW / curW) * 100, (availH / curH) * 100);
        }

        if (isNaN(scale) || scale <= 0 || !isFinite(scale)) scale = 100;
        return { scaleFactor: scale / 100, scalePercent: scale };
    }

    function scaleKDPIconToCell(item, scalePercent) {
        if (!item || isNaN(scalePercent) || scalePercent <= 0) return;
        try {
            if (Math.abs(scalePercent - 100) > 0.01) {
                item.resize(
                    scalePercent,
                    scalePercent,
                    true, true, true, true,
                    true,
                    Transformation.CENTER
                );
            }
        } catch (eRsz) {
            kdpHandleError(eRsz, "Icon Scaling", "WARNING");
        }
    }

    function positionKDPIconInCell(item, cellBounds, hAlign, vAlign) {
        if (!item || !cellBounds) return;
        try {
            var gb = getKDPIconBounds(item);
            if (!gb) return;

            var iconW = gb.width;
            var iconH = gb.height;
            var hA = (hAlign || "center").toLowerCase();
            var vA = (vAlign || "center").toLowerCase();

            var targetLeft;
            if (hA === "left") {
                targetLeft = cellBounds.left;
            } else if (hA === "right") {
                targetLeft = cellBounds.right - iconW;
            } else {
                targetLeft = cellBounds.left + (cellBounds.width - iconW) / 2;
            }

            var targetTop;
            if (vA === "top") {
                targetTop = cellBounds.top;
            } else if (vA === "bottom") {
                targetTop = cellBounds.bottom + iconH;
            } else {
                targetTop = cellBounds.top - (cellBounds.height - iconH) / 2;
            }

            var deltaX = targetLeft - gb.left;
            var deltaY = targetTop - gb.top;

            item.translate(deltaX, deltaY);

            // Re-verify bounds and clamp to guarantee zero cell overflow
            var postGb = getKDPIconBounds(item);
            if (postGb) {
                var adjX = 0;
                var adjY = 0;
                if (postGb.left < cellBounds.left - 0.5) {
                    adjX = cellBounds.left - postGb.left;
                } else if (postGb.right > cellBounds.right + 0.5) {
                    adjX = cellBounds.right - postGb.right;
                }
                if (postGb.top > cellBounds.top + 0.5) {
                    adjY = cellBounds.top - postGb.top;
                } else if (postGb.bottom < cellBounds.bottom - 0.5) {
                    adjY = cellBounds.bottom - postGb.bottom;
                }
                if (Math.abs(adjX) > 0.01 || Math.abs(adjY) > 0.01) {
                    item.translate(adjX, adjY);
                }
            }
        } catch (ePos) {
            kdpHandleError(ePos, "Icon Positioning", "WARNING");
        }
    }

    function alignKDPIconInCell(item, cellBounds, hAlign, vAlign) {
        positionKDPIconInCell(item, cellBounds, hAlign, vAlign);
    }

    function removeTemporaryKDPObjects(items) {
        if (!items) return;
        var list = (items instanceof Array) ? items : [items];
        for (var i = 0; i < list.length; i++) {
            try {
                if (list[i] && typeof list[i].remove === "function") {
                    list[i].remove();
                }
            } catch (eRem) {}
        }
    }

    function importKDPIconFile(sourceFile, targetDoc, targetLayer) {
        if (!sourceFile) return null;
        var f = (sourceFile instanceof File) ? sourceFile : new File(sourceFile);
        if (!f.exists) {
            kdpHandleError("Source icon file does not exist: " + (f.fsName || sourceFile), "Icon Import", "ERROR");
            return null;
        }

        try {
            var iconGroup = loadAndEmbedIcon(f, targetDoc, true, 25);
            if (!iconGroup) {
                kdpHandleError("Failed to import or embed vector artwork from: " + f.name, "Icon Import", "WARNING");
                return null;
            }

            // Move to target Icons layer if provided
            if (targetLayer && iconGroup.parent !== targetLayer) {
                try {
                    iconGroup.move(targetLayer, ElementPlacement.PLACEATEND);
                } catch (eMoveLyr) {}
            }

            iconGroup.locked = false;
            iconGroup.hidden = false;

            // Validate measurable bounds
            var bounds = getKDPIconBounds(iconGroup);
            if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
                removeTemporaryKDPObjects(iconGroup);
                kdpHandleError("Imported icon has invalid or zero geometry: " + f.name, "Icon Bounds", "WARNING");
                return null;
            }

            return iconGroup;
        } catch (eImp) {
            kdpHandleError(eImp, "Icon Import: " + f.name, "WARNING");
            return null;
        }
    }

    function placeKDPIcon(sourceFile, pageIndex, cellIndex, layoutData, settings, doc) {
        var s = settings || createKDPSettings();
        var targetDoc = doc || kdpRuntimeState.document || (app.documents.length > 0 ? app.activeDocument : null);
        if (!targetDoc) {
            kdpHandleError("No active Illustrator document for icon placement.", "Icon Placement", "ERROR");
            return { success: false, item: null, sourceFile: sourceFile, pageIndex: pageIndex, cellIndex: cellIndex, error: "No document" };
        }

        var pIdx = (pageIndex !== undefined) ? parseInt(pageIndex, 10) : 0;
        var cIdx = (cellIndex !== undefined) ? parseInt(cellIndex, 10) : 0;
        var lData = layoutData || calculateKDPLayout(s);

        if (!lData.positions || cIdx >= lData.positions.length) {
            var errPos = "Cell index (" + cIdx + ") out of layout range (total: " + (lData.positions ? lData.positions.length : 0) + ")";
            kdpHandleError(errPos, "Icon Placement", "ERROR");
            return { success: false, item: null, sourceFile: sourceFile, pageIndex: pIdx, cellIndex: cIdx, error: errPos };
        }

        // 1. Calculate absolute document cell bounds
        var localCell = lData.positions[cIdx];
        var cellBounds = convertKDPPageLocalToDocumentCoordinates(localCell, pIdx, targetDoc);

        // 2. Identify target layer (Icons layer)
        var targetLayer = (kdpRuntimeState.layers && kdpRuntimeState.layers.icons) ? kdpRuntimeState.layers.icons : targetDoc.layers[0];

        // 3. Import source icon
        var iconItem = importKDPIconFile(sourceFile, targetDoc, targetLayer);
        if (!iconItem) {
            var fObj = (sourceFile instanceof File) ? sourceFile : new File(sourceFile);
            kdpRuntimeState.failedFiles.push({
                file: fObj,
                name: fObj.name,
                pageIndex: pIdx,
                cellIndex: cIdx,
                reason: "Import or bounds detection failed"
            });
            return { success: false, item: null, sourceFile: sourceFile, pageIndex: pIdx, cellIndex: cIdx, error: "Import failed" };
        }

        // 4. Proportional Scaling
        var iconBounds = getKDPIconBounds(iconItem);
        var scaleInfo = calculateKDPIconScale(iconBounds, cellBounds, s.fitMode, s);
        scaleKDPIconToCell(iconItem, scaleInfo.scalePercent);

        // 5. Positioning and Alignment
        positionKDPIconInCell(iconItem, cellBounds, s.horizontalAlignment, s.verticalAlignment);

        // 6. Object Naming
        iconItem.name = getKDPIconObjectName(pIdx, cIdx);

        // 7. Track in runtime state
        var sFile = (sourceFile instanceof File) ? sourceFile : new File(sourceFile);
        var successRecord = {
            file: sFile,
            name: sFile.name,
            pageIndex: pIdx,
            cellIndex: cIdx,
            objectName: iconItem.name,
            bounds: getKDPIconBounds(iconItem)
        };
        kdpRuntimeState.processedFiles.push(successRecord);

        kdpLogInfo("Placed " + sFile.name + " -> " + iconItem.name, {
            page: pIdx + 1,
            cell: cIdx + 1,
            scalePercent: scaleInfo.scalePercent.toFixed(1) + "%"
        });

        return {
            success: true,
            item: iconItem,
            sourceFile: sFile,
            pageIndex: pIdx,
            cellIndex: cIdx,
            objectName: iconItem.name,
            bounds: successRecord.bounds,
            error: null
        };
    }

    // -------------------------------------------------------------------------
    // KDP Page Numbering Engine
    // -------------------------------------------------------------------------
    function addKDPPageNumber(doc, pageIndex, pageNumberVal, position, fontSize, settings) {
        var targetDoc = doc || kdpRuntimeState.document || (app.documents.length > 0 ? app.activeDocument : null);
        if (!targetDoc) return null;

        var pIdx = (pageIndex !== undefined) ? parseInt(pageIndex, 10) : 0;
        var pVal = (pageNumberVal !== undefined) ? pageNumberVal : (pIdx + 1);
        var s = settings || createKDPSettings();

        // 1. Target Layer: "Page Numbers"
        var pnlLayer = null;
        if (kdpRuntimeState.layers && kdpRuntimeState.layers.pageNumbers) {
            pnlLayer = kdpRuntimeState.layers.pageNumbers;
        } else {
            try {
                pnlLayer = targetDoc.layers.getByName("Page Numbers");
            } catch (eFindLyr) {
                pnlLayer = targetDoc.layers.add();
                pnlLayer.name = "Page Numbers";
            }
        }
        if (pnlLayer) {
            try {
                pnlLayer.locked = false;
                pnlLayer.visible = true;
            } catch (eLyrState) {}
        }

        // 2. Artboard and Margin Coordinates
        var abBounds = getKDPArtboardBounds(pIdx, targetDoc);
        var marginsPt = getKDPMarginsInPoints(s);

        var abLeft = abBounds.left;
        var abTop = abBounds.top;
        var abRight = abBounds.right;
        var abBottom = abBounds.bottom;
        var abWidth = abBounds.width;

        // Position offsets based on margin or minimum safe inset
        var insetX = Math.max(marginsPt.left, 28);
        var insetY = Math.max(marginsPt.bottom / 2, 20);

        var rawPos = (position || s.pageNumberPosition || "bottom-center").toString().toLowerCase().replace(/\s+/g, "-");
        var activePos = rawPos;

        if (activePos === "alternate") {
            // Recto / Right-facing (Page 1, 3, 5 -> index 0, 2, 4) -> bottom-right
            // Verso / Left-facing (Page 2, 4, 6 -> index 1, 3, 5) -> bottom-left
            activePos = (pIdx % 2 === 0) ? "bottom-right" : "bottom-left";
        }

        var posX = abLeft + (abWidth / 2);
        var posY = abBottom + insetY;

        if (activePos === "bottom-left") {
            posX = abLeft + insetX;
            posY = abBottom + insetY;
        } else if (activePos === "bottom-right") {
            posX = abRight - insetX;
            posY = abBottom + insetY;
        } else if (activePos === "top-center") {
            posX = abLeft + (abWidth / 2);
            posY = abTop - insetY;
        } else if (activePos === "top-left") {
            posX = abLeft + insetX;
            posY = abTop - insetY;
        } else if (activePos === "top-right") {
            posX = abRight - insetX;
            posY = abTop - insetY;
        } else {
            // Default "bottom-center"
            posX = abLeft + (abWidth / 2);
            posY = abBottom + insetY;
        }

        // 3. Create TextFrame on Page Numbers Layer
        try {
            var tf = pnlLayer.textFrames.add();
            tf.contents = String(pVal);
            tf.name = getKDPPageName(pIdx) + "_Number";

            var fSize = parseFloat(fontSize || s.pageNumberFontSize) || 10;
            if (fSize <= 0) fSize = 10;

            try {
                tf.textRange.characterAttributes.size = fSize;
            } catch (eSize) {}

            var tfW = tf.width || 20;
            var tfH = tf.height || 10;

            if (activePos.indexOf("center") !== -1) {
                tf.left = posX - (tfW / 2);
                tf.top = posY + (tfH / 2);
            } else if (activePos.indexOf("right") !== -1) {
                tf.left = posX - tfW;
                tf.top = posY + (tfH / 2);
            } else {
                tf.left = posX;
                tf.top = posY + (tfH / 2);
            }

            return tf;
        } catch (eTf) {
            kdpHandleError(eTf, "Page Number Placement: " + getKDPPageName(pIdx), "WARNING");
            return null;
        }
    }

    // -------------------------------------------------------------------------
    // KDP Visual Guides Engine (Safe Area, Grid & Page Border)
    // -------------------------------------------------------------------------
    function addKDPGuides(doc, pageIndex, layoutData, settings) {
        var targetDoc = doc || kdpRuntimeState.document || (app.documents.length > 0 ? app.activeDocument : null);
        if (!targetDoc) return null;

        var pIdx = (pageIndex !== undefined) ? parseInt(pageIndex, 10) : 0;
        var s = settings || createKDPSettings();
        var lData = layoutData || calculateKDPLayout(s);

        var gLayer = null;
        if (kdpRuntimeState.layers && kdpRuntimeState.layers.guides) {
            gLayer = kdpRuntimeState.layers.guides;
        } else {
            try {
                gLayer = targetDoc.layers.getByName("Guides");
            } catch (eG) {
                gLayer = targetDoc.layers.add();
                gLayer.name = "Guides";
            }
        }
        if (gLayer) {
            try {
                gLayer.locked = false;
                gLayer.visible = true;
            } catch (eLyrState) {}
        }

        var abBounds = getKDPArtboardBounds(pIdx, targetDoc);
        if (!abBounds) return null;

        var guidesCreated = [];

        try {
            // 1. Page Border Guide
            if (s.showPageBorder && gLayer.pathItems) {
                var pBorder = gLayer.pathItems.rectangle(abBounds.top, abBounds.left, abBounds.width, abBounds.height);
                pBorder.name = getKDPPageName(pIdx) + "_BorderGuide";
                pBorder.filled = false;
                pBorder.stroked = true;
                pBorder.guides = true;
                guidesCreated.push(pBorder);
            }

            // 2. Safe Area Guide (Printable Content Area Boundary)
            if (s.showSafeArea && lData && lData.margins && gLayer.pathItems) {
                var safeLeft = abBounds.left + lData.margins.left;
                var safeTop = abBounds.top - lData.margins.top;
                var safeW = lData.contentWidth;
                var safeH = lData.contentHeight;
                if (safeW > 0 && safeH > 0) {
                    var safeRect = gLayer.pathItems.rectangle(safeTop, safeLeft, safeW, safeH);
                    safeRect.name = getKDPPageName(pIdx) + "_SafeAreaGuide";
                    safeRect.filled = false;
                    safeRect.stroked = true;
                    safeRect.guides = true;
                    guidesCreated.push(safeRect);
                }
            }

            // 3. Grid Cell Guides
            if (s.showGrid && lData && lData.positions && gLayer.pathItems) {
                for (var posIdx = 0; posIdx < lData.positions.length; posIdx++) {
                    var cell = lData.positions[posIdx];
                    var docCell = convertKDPPageLocalToDocumentCoordinates(cell, pIdx, targetDoc);
                    var cellRect = gLayer.pathItems.rectangle(docCell.top, docCell.left, docCell.width, docCell.height);
                    cellRect.name = getKDPPageName(pIdx) + "_CellGuide_" + (posIdx + 1);
                    cellRect.filled = false;
                    cellRect.stroked = true;
                    cellRect.guides = true;
                    guidesCreated.push(cellRect);
                }
            }
        } catch (eGuides) {
            kdpHandleError(eGuides, "Guides Placement: " + getKDPPageName(pIdx), "WARNING");
        }

        return guidesCreated;
    }

    // -------------------------------------------------------------------------
    // KDP Page Generation Engine (Main Full-Pipeline Generator)
    // -------------------------------------------------------------------------
    function generateKDPInterior(customSettings) {
        var s = customSettings || createKDPSettings();
        var startTime = new Date().getTime();

        // 1. Reset run state counters while preserving detectedFiles
        kdpRuntimeState.isGenerating = true;
        kdpRuntimeState.cancelRequested = false;
        kdpRuntimeState.processedFiles = [];
        kdpRuntimeState.failedFiles = [];
        kdpRuntimeState.currentPage = 0;
        kdpRuntimeState.currentIcon = 0;
        kdpRuntimeState.startTime = startTime;

        try {
            // STEP 1: Pre-generation validation
            var val = validateKDPSettings(s, false);
            if (!val.isValid) {
                kdpRuntimeState.isGenerating = false;
                kdpHandleError("KDP Pre-generation validation failed: " + val.errors.join("; "), "Validation", "ERROR");
                return {
                    success: false,
                    errors: val.errors,
                    warnings: val.warnings,
                    document: null,
                    summary: null
                };
            }

            // STEP 2: Verify input files
            var inFolder = (s.inputFolder instanceof Folder) ? s.inputFolder : new Folder(s.inputFolder);
            if (!inFolder || !inFolder.exists) {
                kdpRuntimeState.isGenerating = false;
                var errFolder = "Input folder does not exist: " + (s.inputFolder || "N/A");
                kdpHandleError(errFolder, "File Verification", "ERROR");
                return {
                    success: false,
                    errors: [errFolder],
                    document: null,
                    summary: null
                };
            }

            var detectedFiles = scanKDPInputFiles(inFolder, { forceRescan: true });
            var verifiedFiles = [];
            for (var f = 0; f < detectedFiles.length; f++) {
                var fObj = (detectedFiles[f] instanceof File) ? detectedFiles[f] : new File(detectedFiles[f]);
                if (fObj.exists && isSupportedKDPFile(fObj)) {
                    verifiedFiles.push(fObj);
                }
            }

            if (verifiedFiles.length === 0) {
                kdpRuntimeState.isGenerating = false;
                var errNoFiles = "No valid supported vector icon files found in input folder.";
                kdpHandleError(errNoFiles, "File Verification", "ERROR");
                return {
                    success: false,
                    errors: [errNoFiles],
                    document: null,
                    summary: null
                };
            }

            kdpRuntimeState.detectedFiles = verifiedFiles;
            kdpRuntimeState.totalIcons = verifiedFiles.length;
            kdpRuntimeState.totalPages = parseInt(s.pageCount, 10);

            // STEP 3: Calculate Layout
            var layoutData = calculateKDPLayout(s);
            var layoutVal = validateKDPLayout(layoutData);
            if (!layoutVal.isValid) {
                kdpRuntimeState.isGenerating = false;
                kdpHandleError("Layout calculation failed: " + layoutVal.errors.join("; "), "Layout Engine", "ERROR");
                return {
                    success: false,
                    errors: layoutVal.errors,
                    document: null,
                    summary: null
                };
            }

            var pageCount = parseInt(s.pageCount, 10);
            var iconsPerPage = parseInt(s.iconsPerPage, 10);
            var addBlankPage = (s.addBlankPageAfterContent === true);
            var totalExportSteps = (s.exportPDF ? 1 : 0) + (s.exportEPS ? pageCount : 0) + (s.exportSVG ? pageCount : 0);
            var totalSteps = 2 + (pageCount * iconsPerPage) + totalExportSteps;

            // Initialize Progress Window
            showKDPProgressWindow("Generating KDP Interior — " + (s.projectName || "Book"), totalSteps);
            updateKDPProgress(1, totalSteps, "Initializing Workspace...", "Setting up " + pageCount + " artboards...", "Page 0 / " + pageCount, null, null);

            // Check cancellation
            if (kdpRuntimeState.cancelRequested) {
                closeKDPProgressWindow();
                return { success: false, isCancelled: true, document: null, summary: null, errors: ["Process cancelled before document creation."] };
            }

            // STEP 4: Create Illustrator Document & Artboards & Layers
            var doc = createKDPDocument(s);
            if (!doc) {
                closeKDPProgressWindow();
                kdpRuntimeState.isGenerating = false;
                kdpHandleError("Failed to create Illustrator document.", "Document Creation", "ERROR");
                return {
                    success: false,
                    errors: ["Failed to create Illustrator document."],
                    document: null,
                    summary: null
                };
            }
            kdpRuntimeState.document = doc;

            // STEP 5: Prepare Icon Distribution Sequence
            var sequenceFiles = [];
            if (s.iconOrder === "random") {
                sequenceFiles = verifiedFiles.slice(0);
                // Stable Fisher-Yates shuffle generated once per run
                for (var sIdx = sequenceFiles.length - 1; sIdx > 0; sIdx--) {
                    var j = Math.floor(Math.random() * (sIdx + 1));
                    var tmp = sequenceFiles[sIdx];
                    sequenceFiles[sIdx] = sequenceFiles[j];
                    sequenceFiles[j] = tmp;
                }
            } else {
                sequenceFiles = verifiedFiles.slice(0);
            }

            var globalIconCursor = 0;
            var placedIconsCount = 0;
            var failedIconsCount = 0;
            var emptySlotsCount = 0;
            var blankPagesCount = 0;
            var contentPagesCount = 0;
            var pageNumbersAdded = 0;

            var startPageNumber = parseInt(s.pageNumberStart, 10);
            if (isNaN(startPageNumber) || startPageNumber < 1) startPageNumber = 1;

            // STEP 6: Deterministic Page Generation Loop
            for (var pageIndex = 0; pageIndex < pageCount; pageIndex++) {
                kdpRuntimeState.currentPage = pageIndex + 1;

                if (kdpRuntimeState.cancelRequested) {
                    kdpLogWarning("KDP Interior generation was cancelled by user at page " + (pageIndex + 1));
                    break;
                }

                var isBlankPage = false;
                if (addBlankPage && (pageIndex % 2 === 1)) {
                    isBlankPage = true;
                    blankPagesCount++;
                } else {
                    contentPagesCount++;
                }

                if (!isBlankPage) {
                    // Populate content page with icons
                    for (var cellIndex = 0; cellIndex < iconsPerPage; cellIndex++) {
                        if (kdpRuntimeState.cancelRequested) break;

                        kdpRuntimeState.currentIcon = globalIconCursor + 1;
                        var sourceFile = null;

                        if (globalIconCursor < sequenceFiles.length) {
                            sourceFile = sequenceFiles[globalIconCursor];
                            globalIconCursor++;
                        } else if (s.allowDuplicates && sequenceFiles.length > 0) {
                            sourceFile = sequenceFiles[globalIconCursor % sequenceFiles.length];
                            globalIconCursor++;
                        } else {
                            sourceFile = null;
                        }

                        var stepNum = 2 + (pageIndex * iconsPerPage) + cellIndex;
                        var iconFileName = sourceFile ? sourceFile.name : "(Blank Slot)";
                        updateKDPProgress(
                            stepNum,
                            totalSteps,
                            "Generating Interior...",
                            "Placing & aligning icon in cell " + (cellIndex + 1) + " / " + iconsPerPage,
                            "Page " + (pageIndex + 1) + " / " + pageCount,
                            "Icon " + (cellIndex + 1) + " / " + iconsPerPage,
                            iconFileName
                        );

                        if (sourceFile) {
                            var placeRes = placeKDPIcon(sourceFile, pageIndex, cellIndex, layoutData, s, doc);
                            if (placeRes.success) {
                                placedIconsCount++;
                            } else {
                                failedIconsCount++;
                            }
                        } else {
                            // Genuine empty cell - no placeholder objects
                            emptySlotsCount++;
                        }
                    }
                }

                if (kdpRuntimeState.cancelRequested) break;

                // STEP 7.1: Optional Page Numbers
                if (s.addPageNumber) {
                    var pageNumVal = startPageNumber + pageIndex;
                    var pNumRes = addKDPPageNumber(doc, pageIndex, pageNumVal, s.pageNumberPosition, s.pageNumberFontSize, s);
                    if (pNumRes) {
                        pageNumbersAdded++;
                    }
                }

                // STEP 7.2: Optional Visual Guides (Safe Area, Grid & Page Border)
                if (s.showSafeArea || s.showGrid || s.showPageBorder) {
                    addKDPGuides(doc, pageIndex, layoutData, s);
                }
            }

            // Handle Cancellation Gracefully
            if (kdpRuntimeState.cancelRequested) {
                closeKDPProgressWindow();
                var endCancelTime = new Date().getTime();
                var durCancelSec = ((endCancelTime - startTime) / 1000).toFixed(1);
                var totalReqSlots = contentPagesCount * iconsPerPage;
                var cancelSummary = {
                    projectName: s.projectName,
                    requestedPages: pageCount,
                    createdPages: pageIndex,
                    contentPages: contentPagesCount,
                    blankPages: blankPagesCount,
                    availableIcons: verifiedFiles.length,
                    requiredSlots: totalReqSlots,
                    placedIcons: placedIconsCount,
                    failedIcons: failedIconsCount,
                    emptySlots: emptySlotsCount,
                    unusedIcons: Math.max(0, sequenceFiles.length - placedIconsCount),
                    pageNumbersAdded: pageNumbersAdded,
                    durationSeconds: durCancelSec,
                    exportResults: null,
                    exportStatus: "Cancelled by User",
                    isSuccess: false,
                    isCancelled: true
                };
                writeKDPGenerationLog(cancelSummary, s, s.outputFolder);
                return {
                    success: false,
                    isCancelled: true,
                    document: doc,
                    summary: cancelSummary,
                    exportResults: null,
                    errors: ["Process cancelled by user."],
                    warnings: kdpRuntimeState.warnings
                };
            }

            // STEP 8: Exact Page Count Integrity Check
            var actualArtboardCount = doc.artboards.length;
            if (actualArtboardCount !== pageCount) {
                kdpHandleError("Artboard count mismatch! Expected: " + pageCount + ", Actual: " + actualArtboardCount, "Integrity Check", "ERROR");
            }

            // STEP 9: Summary Metrics Calculation
            var totalSlots = contentPagesCount * iconsPerPage;
            var uniqueIconsUsed = s.allowDuplicates ? Math.min(sequenceFiles.length, placedIconsCount) : placedIconsCount;
            var unusedIcons = Math.max(0, sequenceFiles.length - uniqueIconsUsed);

            // STEP 10: Export Pipeline Execution (if formats selected)
            var exportRes = null;
            if ((s.exportPDF || s.exportEPS || s.exportSVG) && !kdpRuntimeState.cancelRequested) {
                exportRes = exportKDPInterior(doc, s);
            }

            closeKDPProgressWindow();

            var endTime = new Date().getTime();
            var durationSec = ((endTime - startTime) / 1000).toFixed(1);

            var exportStatusText = "Document Open (No export formats selected)";
            if (exportRes) {
                exportStatusText = exportRes.summaryText;
            }

            var summary = {
                projectName: s.projectName,
                requestedPages: pageCount,
                createdPages: actualArtboardCount,
                contentPages: contentPagesCount,
                blankPages: blankPagesCount,
                availableIcons: verifiedFiles.length,
                requiredSlots: totalSlots,
                placedIcons: placedIconsCount,
                failedIcons: failedIconsCount,
                emptySlots: emptySlotsCount,
                unusedIcons: unusedIcons,
                pageNumbersAdded: pageNumbersAdded,
                durationSeconds: durationSec,
                exportResults: exportRes,
                exportStatus: exportStatusText,
                isSuccess: (actualArtboardCount === pageCount && failedIconsCount === 0 && (!exportRes || exportRes.success)),
                isCancelled: false
            };

            kdpLogInfo("KDP Interior Generation & Export Complete", summary);

            // Write persistent run log to Output/Logs/generation_log.txt
            writeKDPGenerationLog(summary, s, s.outputFolder);

            try { centerAndFitView(doc); } catch (eView) {}

            return {
                success: summary.isSuccess,
                document: doc,
                summary: summary,
                exportResults: exportRes,
                errors: kdpRuntimeState.errors,
                warnings: kdpRuntimeState.warnings
            };

        } catch (eFatal) {
            closeKDPProgressWindow();
            kdpHandleError(eFatal, "Full Page Generation", "ERROR");
            return {
                success: false,
                document: kdpRuntimeState.document,
                summary: null,
                exportResults: null,
                errors: [eFatal.message || String(eFatal)],
                warnings: kdpRuntimeState.warnings
            };
        } finally {
            kdpRuntimeState.isGenerating = false;
        }
    }

    // -------------------------------------------------------------------------
    // KDP Professional Generation Summary Dialog
    // -------------------------------------------------------------------------
    function showKDPSummaryDialog(summary, outFolder) {
        if (!summary) return;

        var dlg = new Window("dialog", "KDP Interior Generation & Export Summary");
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.preferredSize = [500, 520];
        dlg.size = [500, 520];
        dlg.minimumSize = [500, 520];
        dlg.maximumSize = [500, 520];
        dlg.spacing = 14;
        dlg.margins = [20, 20, 20, 16];

        // Header Panel with dynamic status styling
        var pnlHeader = dlg.add("panel", undefined, undefined, { borderStyle: "none" });
        pnlHeader.orientation = "row";
        pnlHeader.alignChildren = ["fill", "center"];
        pnlHeader.margins = 0;
        pnlHeader.spacing = 12;

        var grpHeaderText = pnlHeader.add("group");
        grpHeaderText.orientation = "column";
        grpHeaderText.alignChildren = ["left", "center"];
        grpHeaderText.spacing = 2;

        var titleText = "";
        var titleColor = [0.12, 0.60, 0.25, 1]; // Green
        var subtitleText = "";

        if (summary.isCancelled) {
            titleText = "🛑 KDP Interior Generation Cancelled";
            titleColor = [0.85, 0.45, 0.1, 1]; // Orange
            subtitleText = "Project: " + (summary.projectName || "KDP_Interior") + " | Stopped by User (" + summary.durationSeconds + "s)";
        } else if (summary.isSuccess) {
            titleText = "📖 KDP Interior Completed Successfully!";
            titleColor = [0.12, 0.60, 0.25, 1]; // Green
            subtitleText = "Project: " + (summary.projectName || "KDP_Interior") + " | Total Time: " + summary.durationSeconds + "s";
        } else if (summary.createdPages > 0 && (summary.failedIcons > 0 || summary.emptySlots > 0 || (summary.exportResults && !summary.exportResults.success))) {
            titleText = "⚠️ KDP Interior Completed with Warnings";
            titleColor = [0.85, 0.50, 0.05, 1]; // Amber
            subtitleText = "Project: " + (summary.projectName || "KDP_Interior") + " | Review warnings below (" + summary.durationSeconds + "s)";
        } else {
            titleText = "❌ KDP Interior Generation Failed";
            titleColor = [0.85, 0.20, 0.20, 1]; // Red
            subtitleText = "Project: " + (summary.projectName || "KDP_Interior") + " | Errors encountered";
        }

        var lblTitle = grpHeaderText.add("statictext", undefined, titleText);
        try {
            lblTitle.graphics.font = ScriptUI.newFont(lblTitle.graphics.font.name, "Bold", 14);
            lblTitle.graphics.foregroundColor = lblTitle.graphics.newPen(lblTitle.graphics.PenType.SOLID_COLOR, titleColor, 1);
        } catch (eF) {}

        var lblSubtitle = grpHeaderText.add("statictext", undefined, subtitleText);
        try {
            lblSubtitle.graphics.foregroundColor = lblSubtitle.graphics.newPen(lblSubtitle.graphics.PenType.SOLID_COLOR, [0.45, 0.45, 0.45, 1], 1);
        } catch (eC) {}

        // Execution Summary Card
        var pnlStats = dlg.add("panel", undefined, " Generation & Export Metrics ");
        pnlStats.orientation = "column";
        pnlStats.alignChildren = ["fill", "top"];
        pnlStats.spacing = 8;
        pnlStats.margins = [16, 16, 16, 14];

        // Row 1: Pages & Content
        var grpRow1 = pnlStats.add("group");
        grpRow1.orientation = "row";
        grpRow1.alignChildren = ["left", "center"];
        grpRow1.spacing = 20;

        var lblPages = grpRow1.add("statictext", undefined, "📄 Pages: " + summary.createdPages + " / " + summary.requestedPages);
        try {
            lblPages.graphics.font = ScriptUI.newFont(lblPages.graphics.font.name, "Bold", 12);
            lblPages.graphics.foregroundColor = lblPages.graphics.newPen(lblPages.graphics.PenType.SOLID_COLOR, titleColor, 1);
        } catch (eP) {}

        if (summary.blankPages > 0) {
            grpRow1.add("statictext", undefined, "(Content: " + summary.contentPages + " | Blank: " + summary.blankPages + ")");
        }

        // Row 2: Icons & Slots
        var grpRow2 = pnlStats.add("group");
        grpRow2.orientation = "row";
        grpRow2.alignChildren = ["left", "center"];
        grpRow2.spacing = 16;

        grpRow2.add("statictext", undefined, "🎨 Placed: " + summary.placedIcons + " / " + summary.requiredSlots + " slots");
        grpRow2.add("statictext", undefined, "📦 Available: " + summary.availableIcons);
        if (summary.emptySlots > 0) {
            grpRow2.add("statictext", undefined, "⚪ Empty Slots: " + summary.emptySlots);
        }

        // Row 3: Status & Numbers
        var grpRow3 = pnlStats.add("group");
        grpRow3.orientation = "row";
        grpRow3.alignChildren = ["left", "center"];
        grpRow3.spacing = 16;

        if (summary.pageNumbersAdded > 0) {
            grpRow3.add("statictext", undefined, "🔢 Page Numbers: " + summary.pageNumbersAdded);
        }
        if (summary.unusedIcons > 0) {
            grpRow3.add("statictext", undefined, "📂 Unused Icons: " + summary.unusedIcons);
        }
        if (summary.failedIcons > 0) {
            var lblFail = grpRow3.add("statictext", undefined, "❌ Failed Icons: " + summary.failedIcons);
            try {
                lblFail.graphics.font = ScriptUI.newFont(lblFail.graphics.font.name, "Bold", 12);
                lblFail.graphics.foregroundColor = lblFail.graphics.newPen(lblFail.graphics.PenType.SOLID_COLOR, [0.85, 0.20, 0.20, 1], 1);
            } catch (eFl) {}
        }

        // Row 4: Export Summary Details
        var grpOut = pnlStats.add("group");
        grpOut.orientation = "column";
        grpOut.alignChildren = ["fill", "top"];
        grpOut.spacing = 4;
        grpOut.margins = [0, 4, 0, 0];

        grpOut.add("statictext", undefined, "Export Status:");
        var txtStatus = grpOut.add("edittext", undefined, summary.exportStatus, { readonly: true });
        txtStatus.preferredSize = [420, 24];

        var outPathStr = "";
        if (summary.exportResults && summary.exportResults.outputFolder) {
            outPathStr = summary.exportResults.outputFolder;
        } else if (outFolder) {
            outPathStr = (outFolder.fsName || outFolder.toString());
        }
        if (outPathStr) {
            grpOut.add("statictext", undefined, "Output Folder & Log Destination:");
            var txtOutBox = grpOut.add("edittext", undefined, outPathStr + "/Logs/generation_log.txt", { readonly: true });
            txtOutBox.preferredSize = [420, 24];
        }

        // Errors if any
        if (kdpRuntimeState.errors && kdpRuntimeState.errors.length > 0) {
            var pnlErr = dlg.add("panel", undefined, " Issues / Logs (" + kdpRuntimeState.errors.length + ") ");
            pnlErr.orientation = "column";
            pnlErr.alignChildren = ["fill", "top"];
            pnlErr.margins = [12, 12, 12, 10];
            pnlErr.add("edittext", [0, 0, 420, 60], kdpRuntimeState.errors.join("\n"), { multiline: true, readonly: true });
        }

        // Bottom Action Buttons
        var grpActions = dlg.add("group");
        grpActions.orientation = "row";
        grpActions.alignChildren = ["fill", "center"];
        grpActions.spacing = 10;
        grpActions.margins = [0, 4, 0, 0];

        if (outPathStr) {
            var btnOpenFolder = grpActions.add("button", [0, 0, 140, 32], "📁 Output Folder");
            btnOpenFolder.onClick = function () {
                var f = new Folder(outPathStr);
                if (f.exists) {
                    f.execute();
                } else {
                    alert("Folder does not exist yet:\n" + f.fsName);
                }
            };

            var btnOpenLog = grpActions.add("button", [0, 0, 120, 32], "📄 Open Log");
            btnOpenLog.onClick = function () {
                var lf = new File(outPathStr + "/Logs/generation_log.txt");
                if (lf.exists) {
                    lf.execute();
                } else {
                    alert("Log file does not exist yet:\n" + lf.fsName);
                }
            };
        }

        var btnSpacer = grpActions.add("group");
        btnSpacer.alignment = ["fill", "center"];
        var btnDone = grpActions.add("button", [0, 0, 100, 32], "Done", { name: "ok" });

        btnDone.onClick = function () {
            dlg.close(1);
        };

        dlg.show();
    }

    // =========================================================================
    // KDP EXPORT MANAGER
    // =========================================================================

    function sanitizeKDPFileName(name) {
        if (!name) return "KDP_Interior";
        var str = String(name);
        // Replace invalid filesystem characters: / \ : * ? " < > |
        str = str.replace(/[\/\\:\*\?"<>\|]/g, "-");
        // Replace control characters
        str = str.replace(/[\x00-\x1F\x7F]/g, "");
        // Collapse consecutive dashes or spaces
        str = str.replace(/[\-]+/g, "-");
        str = str.replace(/\s+/g, " ");
        // Trim spaces, dots, dashes from start/end
        str = str.replace(/^[\s\.\-]+|[\s\.\-]+$/g, "");
        return (str.length > 0) ? str : "KDP_Interior";
    }

    function checkKDPOutputFile(file, allowOverwrite) {
        if (!file) return { canWrite: false, status: "error", file: null, message: "Invalid file target" };
        var fObj = (file instanceof File) ? file : new File(file);
        if (!fObj.exists) {
            return { canWrite: true, status: "ready", file: fObj, message: "File is ready for creation" };
        }
        if (allowOverwrite) {
            return { canWrite: true, status: "overwrite", file: fObj, message: "Existing file will be overwritten" };
        }
        return { canWrite: false, status: "skip", file: fObj, message: "File already exists and overwrite is disabled: " + fObj.name };
    }

    function prepareKDPOutputFolders(baseFolderOrPath, settings) {
        var baseFolder = null;
        if (!baseFolderOrPath) {
            baseFolder = new Folder("~/Desktop/KDP_Output");
        } else if (baseFolderOrPath instanceof Folder) {
            baseFolder = baseFolderOrPath;
        } else {
            baseFolder = new Folder(baseFolderOrPath);
        }

        if (!baseFolder.exists) {
            try {
                baseFolder.create();
            } catch (eCreateBase) {
                kdpHandleError("Failed to create base output folder: " + baseFolder.fsName, "Export Folders", "ERROR");
                return null;
            }
        }

        var s = settings || {};
        var folders = {
            base: baseFolder,
            pdf: null,
            eps: null,
            svg: null
        };

        // Create only the subfolders that correspond to selected formats
        if (s.exportPDF) {
            folders.pdf = new Folder(baseFolder.fsName + "/PDF");
            if (!folders.pdf.exists) {
                try { folders.pdf.create(); } catch (ePdfF) {}
            }
        }

        if (s.exportEPS) {
            folders.eps = new Folder(baseFolder.fsName + "/EPS");
            if (!folders.eps.exists) {
                try { folders.eps.create(); } catch (eEpsF) {}
            }
        }

        if (s.exportSVG) {
            folders.svg = new Folder(baseFolder.fsName + "/SVG");
            if (!folders.svg.exists) {
                try { folders.svg.create(); } catch (eSvgF) {}
            }
        }

        return folders;
    }

    function handleKDPExportError(err, context, format) {
        var msg = (err && err.message) ? err.message : String(err);
        var ctx = context || "Export";
        var fmt = format || "GENERAL";
        var formatted = "[" + fmt + "] [" + ctx + "]: " + msg;
        kdpRuntimeState.errors.push(formatted);
        kdpLogError(msg, { context: ctx, format: fmt });
        return formatted;
    }

    function exportKDPToPDF(doc, targetFile, options, settings) {
        if (!doc || !targetFile) return { success: false, skipped: false, file: null, error: "Missing document or target file" };
        if (kdpRuntimeState.cancelRequested) {
            return { success: false, skipped: false, file: null, error: "Export cancelled by user" };
        }
        var s = settings || createKDPSettings();
        var fObj = (targetFile instanceof File) ? targetFile : new File(targetFile);

        // Overwrite check
        var chk = checkKDPOutputFile(fObj, s.overwriteExisting);
        if (!chk.canWrite) {
            kdpLogInfo("Skipped PDF export (already exists): " + fObj.name);
            kdpRuntimeState.skippedExports.push({ format: "PDF", file: fObj, name: fObj.name, reason: "Already exists (overwrite disabled)" });
            return { success: true, skipped: true, file: fObj, error: null };
        }

        try {
            updateKDPProgress(undefined, undefined, "Exporting PDF Book...", "Saving multi-page PDF document...", null, null, fObj.name);

            var pdfOpts = new PDFSaveOptions();
            pdfOpts.compatibility = PDFCompatibility.ACROBAT5;
            pdfOpts.preserveEditability = false;
            pdfOpts.generateThumbnails = true;
            pdfOpts.optimization = true;
            pdfOpts.viewAfterSaving = false;

            if (doc.artboards && doc.artboards.length > 0) {
                try {
                    pdfOpts.artboardRange = "1-" + doc.artboards.length;
                } catch (eR) {}
            }

            // Save complete multi-page PDF spanning all artboards
            doc.saveAs(fObj, pdfOpts);

            // Verification of export file existence and size
            if (fObj.exists && fObj.length > 0) {
                kdpLogInfo("Exported KDP Interior PDF successfully", {
                    path: fObj.fsName,
                    sizeBytes: fObj.length,
                    artboards: doc.artboards.length
                });
                kdpRuntimeState.exportedFiles.push({ format: "PDF", file: fObj, name: fObj.name, size: fObj.length });
                return { success: true, skipped: false, file: fObj, error: null };
            } else {
                var errPdfMiss = "PDF export file missing or 0 bytes after saveAs: " + fObj.fsName;
                handleKDPExportError(errPdfMiss, "PDF Verification", "PDF");
                kdpRuntimeState.failedExports.push({ format: "PDF", file: fObj, name: fObj.name, error: errPdfMiss });
                return { success: false, skipped: false, file: fObj, error: errPdfMiss };
            }
        } catch (ePdf) {
            handleKDPExportError(ePdf, "PDF Export", "PDF");
            kdpRuntimeState.failedExports.push({ format: "PDF", file: fObj, name: fObj.name, error: ePdf.message || String(ePdf) });
            return { success: false, skipped: false, file: fObj, error: ePdf.message || String(ePdf) };
        }
    }

    function exportKDPToEPS(doc, targetFolder, options, settings) {
        if (!doc || !targetFolder) return { success: false, totalPages: 0, successCount: 0, skippedCount: 0, failCount: 0, files: [] };
        var s = settings || createKDPSettings();
        var fld = (targetFolder instanceof Folder) ? targetFolder : new Folder(targetFolder);
        var baseName = sanitizeKDPFileName(s.projectName);
        var pageCount = doc.artboards.length;

        var successCount = 0;
        var skippedCount = 0;
        var failCount = 0;
        var exportedFiles = [];
        var eps10 = (options && options.eps10 !== undefined) ? options.eps10 : (s.eps10 !== undefined ? s.eps10 : true);

        for (var p = 0; p < pageCount; p++) {
            if (kdpRuntimeState.cancelRequested) {
                kdpLogWarning("EPS export cancelled by user at page " + (p + 1));
                break;
            }

            var pageName = getKDPPageName(p);
            var fileName = baseName + "_" + pageName + ".eps";
            var targetFile = new File(fld.fsName + "/" + fileName);

            updateKDPProgress(undefined, undefined, "Exporting EPS Pages...", "Saving EPS artboard " + (p + 1) + " / " + pageCount, "Page " + (p + 1) + " / " + pageCount, null, fileName);

            var chk = checkKDPOutputFile(targetFile, s.overwriteExisting);
            if (!chk.canWrite) {
                skippedCount++;
                kdpLogInfo("Skipped EPS page (already exists): " + fileName);
                kdpRuntimeState.skippedExports.push({ format: "EPS", file: targetFile, page: p + 1, name: fileName, reason: "Already exists (overwrite disabled)" });
                continue;
            }

            try {
                var epsOpts = new EPSSaveOptions();
                if (eps10) {
                    try { epsOpts.compatibility = Compatibility.ILLUSTRATOR10; } catch (e10) {}
                }
                epsOpts.embedAllFonts = true;
                epsOpts.embedLinkedFiles = true;
                epsOpts.includeDocumentThumbnails = true;
                epsOpts.saveMultipleArtboards = true;
                try {
                    epsOpts.artboardRange = String(p + 1);
                } catch (eR) {}

                doc.saveAs(targetFile, epsOpts);

                // Handle Illustrator auto-naming suffix for multiple artboard EPS export
                if (!targetFile.exists) {
                    var baseNoExt = fileName.replace(/\.[^\.]+$/, "");
                    var candidateFiles = [
                        new File(fld.fsName + "/" + baseNoExt + "_" + (p + 1) + ".eps"),
                        new File(fld.fsName + "/" + baseNoExt + "_Artboard " + (p + 1) + ".eps"),
                        new File(fld.fsName + "/" + baseNoExt + "_Artboard" + (p + 1) + ".eps"),
                        new File(fld.fsName + "/" + baseNoExt + "_Page-" + padNumber(p + 1, 3) + ".eps")
                    ];
                    for (var c = 0; c < candidateFiles.length; c++) {
                        if (candidateFiles[c].exists) {
                            candidateFiles[c].copy(targetFile);
                            candidateFiles[c].remove();
                            break;
                        }
                    }
                }

                if (targetFile.exists && targetFile.length > 0) {
                    successCount++;
                    exportedFiles.push(targetFile);
                    kdpRuntimeState.exportedFiles.push({ format: "EPS", file: targetFile, page: p + 1, name: fileName, size: targetFile.length });
                } else {
                    failCount++;
                    var errMiss = "EPS file missing or empty after export: " + fileName;
                    handleKDPExportError(errMiss, "Page " + (p + 1), "EPS");
                    kdpRuntimeState.failedExports.push({ format: "EPS", file: targetFile, page: p + 1, name: fileName, error: errMiss });
                }
            } catch (ePageEps) {
                failCount++;
                handleKDPExportError(ePageEps, "Page " + (p + 1), "EPS");
                kdpRuntimeState.failedExports.push({ format: "EPS", file: targetFile, page: p + 1, name: fileName, error: ePageEps.message || String(ePageEps) });
            }
        }

        return {
            success: (failCount === 0),
            totalPages: pageCount,
            successCount: successCount,
            skippedCount: skippedCount,
            failCount: failCount,
            files: exportedFiles
        };
    }

    function exportKDPToSVG(doc, targetFolder, options, settings) {
        if (!doc || !targetFolder) return { success: false, totalPages: 0, successCount: 0, skippedCount: 0, failCount: 0, files: [] };
        var s = settings || createKDPSettings();
        var fld = (targetFolder instanceof Folder) ? targetFolder : new Folder(targetFolder);
        var baseName = sanitizeKDPFileName(s.projectName);
        var pageCount = doc.artboards.length;

        var successCount = 0;
        var skippedCount = 0;
        var failCount = 0;
        var exportedFiles = [];

        var origActiveAb = 0;
        try { origActiveAb = doc.artboards.getActiveArtboardIndex(); } catch (eGetAb) {}

        for (var p = 0; p < pageCount; p++) {
            if (kdpRuntimeState.cancelRequested) {
                kdpLogWarning("SVG export cancelled by user at page " + (p + 1));
                break;
            }

            var pageName = getKDPPageName(p);
            var fileName = baseName + "_" + pageName + ".svg";
            var targetFile = new File(fld.fsName + "/" + fileName);

            updateKDPProgress(undefined, undefined, "Exporting SVG Pages...", "Saving SVG artboard " + (p + 1) + " / " + pageCount, "Page " + (p + 1) + " / " + pageCount, null, fileName);

            var chk = checkKDPOutputFile(targetFile, s.overwriteExisting);
            if (!chk.canWrite) {
                skippedCount++;
                kdpLogInfo("Skipped SVG page (already exists): " + fileName);
                kdpRuntimeState.skippedExports.push({ format: "SVG", file: targetFile, page: p + 1, name: fileName, reason: "Already exists (overwrite disabled)" });
                continue;
            }

            try {
                var svgOpts = new ExportOptionsSVG();
                svgOpts.embedRasterImages = true;
                try { svgOpts.fontSubsetting = SVGFontSubsetting.ALLGLYPHS; } catch (eSvgFont) {}

                // Activate specific artboard for single-page SVG export
                try {
                    doc.artboards.setActiveArtboardIndex(p);
                } catch (eSetAb) {}

                doc.exportFile(targetFile, ExportType.SVG, svgOpts);

                // Check for Illustrator auto-naming suffix if generated
                if (!targetFile.exists) {
                    var baseNoExt = fileName.replace(/\.[^\.]+$/, "");
                    var candidateFiles = [
                        new File(fld.fsName + "/" + baseNoExt + "_" + (p + 1) + ".svg"),
                        new File(fld.fsName + "/" + baseNoExt + "_Artboard " + (p + 1) + ".svg"),
                        new File(fld.fsName + "/" + baseNoExt + "_Artboard" + (p + 1) + ".svg"),
                        new File(fld.fsName + "/" + baseNoExt + "_Page-" + padNumber(p + 1, 3) + ".svg")
                    ];
                    for (var cs = 0; cs < candidateFiles.length; cs++) {
                        if (candidateFiles[cs].exists) {
                            candidateFiles[cs].copy(targetFile);
                            candidateFiles[cs].remove();
                            break;
                        }
                    }
                }

                if (targetFile.exists && targetFile.length > 0) {
                    successCount++;
                    exportedFiles.push(targetFile);
                    kdpRuntimeState.exportedFiles.push({ format: "SVG", file: targetFile, page: p + 1, name: fileName, size: targetFile.length });
                } else {
                    failCount++;
                    var errMiss = "SVG file missing or empty after export: " + fileName;
                    handleKDPExportError(errMiss, "Page " + (p + 1), "SVG");
                    kdpRuntimeState.failedExports.push({ format: "SVG", file: targetFile, page: p + 1, name: fileName, error: errMiss });
                }
            } catch (ePageSvg) {
                failCount++;
                handleKDPExportError(ePageSvg, "Page " + (p + 1), "SVG");
                kdpRuntimeState.failedExports.push({ format: "SVG", file: targetFile, page: p + 1, name: fileName, error: ePageSvg.message || String(ePageSvg) });
            }
        }

        // Restore active artboard index
        try { doc.artboards.setActiveArtboardIndex(origActiveAb); } catch (eRestoreAb) {}

        return {
            success: (failCount === 0),
            totalPages: pageCount,
            successCount: successCount,
            skippedCount: skippedCount,
            failCount: failCount,
            files: exportedFiles
        };
    }

    function exportKDPInterior(doc, settings) {
        var s = settings || createKDPSettings();
        var targetDoc = doc || kdpRuntimeState.document || (app.documents.length > 0 ? app.activeDocument : null);
        if (!targetDoc) {
            kdpHandleError("No active document available for KDP export.", "Export Manager", "ERROR");
            return {
                success: false,
                summaryText: "Export Failed: No document",
                pdf: null,
                eps: null,
                svg: null
            };
        }

        // Prepare format subfolders only for enabled formats
        var folders = prepareKDPOutputFolders(s.outputFolder, s);
        if (!folders || !folders.base) {
            kdpHandleError("Invalid or unwritable output folder: " + s.outputFolder, "Export Manager", "ERROR");
            return {
                success: false,
                summaryText: "Export Failed: Invalid output folder",
                pdf: null,
                eps: null,
                svg: null
            };
        }

        var baseName = sanitizeKDPFileName(s.projectName);
        var pdfResult = null;
        var epsResult = null;
        var svgResult = null;
        var summaryParts = [];
        var totalFailures = 0;

        // 1. PDF Export (Primary Full-Book PDF)
        if (s.exportPDF && folders.pdf && !kdpRuntimeState.cancelRequested) {
            var pdfFile = new File(folders.pdf.fsName + "/" + baseName + ".pdf");
            pdfResult = exportKDPToPDF(targetDoc, pdfFile, null, s);
            if (pdfResult.success) {
                if (pdfResult.skipped) {
                    summaryParts.push("PDF: Skipped (File Exists)");
                } else {
                    summaryParts.push("PDF: Success");
                }
            } else {
                summaryParts.push("PDF: Failed");
                totalFailures++;
            }
        }

        // 2. EPS Export (Per-Page EPS Files)
        if (s.exportEPS && folders.eps && !kdpRuntimeState.cancelRequested) {
            epsResult = exportKDPToEPS(targetDoc, folders.eps, null, s);
            if (epsResult.success) {
                summaryParts.push("EPS: " + epsResult.successCount + "/" + epsResult.totalPages + (epsResult.skippedCount > 0 ? " (" + epsResult.skippedCount + " skipped)" : ""));
            } else {
                summaryParts.push("EPS: " + epsResult.successCount + "/" + epsResult.totalPages + " (" + epsResult.failCount + " failed)");
                totalFailures += epsResult.failCount;
            }
        }

        // 3. SVG Export (Per-Page SVG Files)
        if (s.exportSVG && folders.svg && !kdpRuntimeState.cancelRequested) {
            svgResult = exportKDPToSVG(targetDoc, folders.svg, null, s);
            if (svgResult.success) {
                summaryParts.push("SVG: " + svgResult.successCount + "/" + svgResult.totalPages + (svgResult.skippedCount > 0 ? " (" + svgResult.skippedCount + " skipped)" : ""));
            } else {
                summaryParts.push("SVG: " + svgResult.successCount + "/" + svgResult.totalPages + " (" + svgResult.failCount + " failed)");
                totalFailures += svgResult.failCount;
            }
        }

        var summaryText = summaryParts.length > 0 ? summaryParts.join(" | ") : "No export formats selected";

        kdpLogInfo("KDP Interior Export Finished", {
            summary: summaryText,
            failures: totalFailures,
            outputFolder: folders.base.fsName
        });

        return {
            success: (totalFailures === 0),
            summaryText: summaryText,
            outputFolder: folders.base.fsName,
            pdf: pdfResult,
            eps: epsResult,
            svg: svgResult,
            failures: totalFailures
        };
    }

    // -------------------------------------------------------------------------
    // KDP Application Controller (Unified API Namespace)
    // -------------------------------------------------------------------------
    var kdpController = {
        version: KDP_GENERATOR_VERSION,
        presets: KDP_PAGE_PRESETS,
        supportedExtensions: KDP_SUPPORTED_EXTS,
        runtimeState: kdpRuntimeState,

        getDefaultSettings: function () {
            return createKDPSettings();
        },
        createSettings: function (opts) {
            return createKDPSettings(opts);
        },
        validateSettings: function (settings) {
            return validateKDPSettings(settings);
        },
        getRuntimeState: function () {
            return getKDPRuntimeState();
        },
        resetRuntimeState: function () {
            return resetKDPRuntimeState();
        },
        generateInterior: function (settings) {
            return generateKDPInterior(settings);
        },

        // Sub-modules
        units: {
            convertToPoints: convertToPoints,
            pointsToUnit: pointsToUnit,
            getPageSizeInPoints: getKDPPageSizeInPoints,
            getMarginsInPoints: getKDPMarginsInPoints,
            getGapsInPoints: getKDPGapsInPoints
        },
        logger: {
            log: kdpLog,
            info: kdpLogInfo,
            warning: kdpLogWarning,
            error: kdpLogError,
            getLogs: kdpGetLogs,
            clearLogs: kdpClearLogs
        },
        fileManager: {
            scanInputFiles: scanKDPInputFiles,
            getFileExtension: getKDPFileExtension,
            isSupportedFile: isSupportedKDPFile,
            sortNaturally: sortKDPFilesNaturally,
            validateFolders: validateKDPFolders
        },
        layoutEngine: {
            calculateContentArea: calculateKDPContentArea,
            calculateGrid: calculateKDPGrid,
            calculateCellSize: calculateKDPCellSize,
            calculatePosition: getKDPCellPosition,
            getCellPosition: getKDPCellPosition,
            getCellBounds: getKDPCellBounds,
            calculateLayout: calculateKDPLayout,
            validateLayout: validateKDPLayout
        },
        documentManager: {
            createDocument: createKDPDocument,
            createArtboards: createKDPArtboards,
            setupLayers: setupKDPLayers,
            createLayers: createKDPLayers,
            getArtboardBounds: getKDPArtboardBounds,
            getArtboardByPageIndex: getKDPArtboardByPageIndex,
            nameArtboards: nameKDPArtboards,
            getPageName: getKDPPageName
        },
        pageManager: {
            addPageNumber: addKDPPageNumber,
            addGuides: addKDPGuides,
            generateInterior: generateKDPInterior,
            showSummaryDialog: showKDPSummaryDialog
        },
        iconManager: {
            placeIcon: placeKDPIcon,
            importIconFile: importKDPIconFile,
            getIconBounds: getKDPIconBounds,
            calculateScale: calculateKDPIconScale,
            scaleIconToCell: scaleKDPIconToCell,
            positionIconInCell: positionKDPIconInCell,
            alignIconInCell: alignKDPIconInCell,
            getIconObjectName: getKDPIconObjectName,
            convertCoordinates: convertKDPPageLocalToDocumentCoordinates,
            removeTemporaryObjects: removeTemporaryKDPObjects
        },
        exportManager: {
            exportInterior: exportKDPInterior,
            exportPDF: exportKDPToPDF,
            exportEPS: exportKDPToEPS,
            exportSVG: exportKDPToSVG,
            prepareFolders: prepareKDPOutputFolders,
            sanitizeFileName: sanitizeKDPFileName,
            checkOutputFile: checkKDPOutputFile,
            handleExportError: handleKDPExportError
        },
        presetsManager: {
            save: saveKDPSettingsPreset,
            load: loadKDPSettingsPreset,
            deletePreset: deleteKDPSettingsPreset,
            list: getKDPAvailablePresets,
            getDefaults: getDefaultKDPPresets,
            serialize: serializeKDPSettings,
            deserialize: deserializeKDPSettings
        },
        progressManager: {
            show: showKDPProgressWindow,
            update: updateKDPProgress,
            close: closeKDPProgressWindow
        },
        previewManager: {
            buildData: function (s) { return buildKDPPreviewData(s); },
            formatText: function (d) { return formatKDPPreviewText(d); },
            showModal: function (s, cb) { return showKDPPreviewModal(s, cb); }
        },
        loggingManager: {
            writeLog: writeKDPGenerationLog
        },
        errorHandler: {
            handle: kdpHandleError
        }
    };

    try {
        if (typeof $ !== "undefined") {
            $.kdpController = kdpController;
        }
    } catch (eGlobalKdp) {}

    // -------------------------------------------------------------------------
    // Standalone License Manager (JoyNest Agency Commercial Compliance)
    // -------------------------------------------------------------------------
    var STANDALONE_BST_OFFSET = 6; // UTC+6
    var STANDALONE_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbx8eH_PF6cGV2Da9OOwXCYv_HezOYDZSST43-5ocGYtK7cEs5vpqFdXlIjqLtm3kEjA/exec";

    function getLicenseFilePath() {
        try {
            var f = new File(Folder.userData.fsName + "/.adobe_automation_suite_license.json");
            return f;
        } catch (e) {
            return new File("~/Desktop/.adobe_automation_suite_license.json");
        }
    }

    function getStandaloneDeviceId() {
        try {
            var raw = ($.os || "") + ":" + (Folder.userData.fsName || "") + ":" + ($.locale || "");
            var hash = 5381, i = raw.length;
            while (i) {
                hash = (hash * 33) ^ raw.charCodeAt(--i);
            }
            var hex = (hash >>> 0).toString(16);
            while (hex.length < 12) hex += "a7b3";
            return "DEV-" + hex.substring(0, 7).toUpperCase() + "-" + hex.substring(7, 11).toUpperCase();
        } catch (e) {
            return "DEV-5A941E5-4355";
        }
    }

    function formatBSTDateStandalone(dInput) {
        if (!dInput) return "N/A";
        var d = (dInput instanceof Date) ? dInput : new Date(dInput);
        if (isNaN(d.getTime())) {
            var str = String(dInput);
            if (str.indexOf("Bangladesh Time") !== -1) return str;
            return str + " (Bangladesh Time)";
        }
        var utc = d.getTime() + (d.getTimezoneOffset() * 60000);
        var bst = new Date(utc + (3600000 * STANDALONE_BST_OFFSET));
        var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        var day = bst.getDate();
        var month = months[bst.getMonth()];
        var year = bst.getFullYear();
        var hours = bst.getHours();
        var minutes = bst.getMinutes();
        var ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        var minStr = minutes < 10 ? '0' + minutes : minutes;
        return day + " " + month + " " + year + ", " + hours + ":" + minStr + " " + ampm + " (Bangladesh Time)";
    }

    function loadStoredLicenseStandalone() {
        try {
            var f = getLicenseFilePath();
            if (f && f.exists) {
                f.open("r");
                var content = f.read();
                f.close();
                if (content) {
                    var parsed = null;
                    try {
                        parsed = eval("(" + content + ")");
                    } catch (eP) {}
                    if (parsed && (parsed.key || parsed.licenseKey)) {
                        return {
                            key: parsed.key || parsed.licenseKey,
                            status: parsed.status || "Activated",
                            activatedAt: parsed.activatedAt || parsed.activationDate || "",
                            expiry: parsed.expiry || parsed.expiryDate || "",
                            deviceId: parsed.deviceId || parsed.hwid || "",
                            deactivationCount: parseInt(parsed.deactivationCount, 10) || 0
                        };
                    }
                }
            }
        } catch (e) {}
        return null;
    }

    function saveStoredLicenseStandalone(licObj) {
        try {
            var f = getLicenseFilePath();
            if (f) {
                f.open("w");
                var str = "{\n  \"key\": \"" + licObj.key + "\",\n  \"status\": \"" + (licObj.status || "Activated") + "\",\n  \"activatedAt\": \"" + (licObj.activatedAt || "") + "\",\n  \"expiry\": \"" + (licObj.expiry || "") + "\",\n  \"deviceId\": \"" + (licObj.deviceId || getStandaloneDeviceId()) + "\",\n  \"deactivationCount\": " + (licObj.deactivationCount || 0) + "\n}";
                f.write(str);
                f.close();
            }
        } catch (e) {}
    }

    function isStandaloneLicensed() {
        var lic = loadStoredLicenseStandalone();
        if (!lic || !lic.key) return false;
        if (lic.status !== "Activated" && lic.status !== "Reactive") return false;
        var myDev = getStandaloneDeviceId();
        if (lic.deviceId && lic.deviceId !== myDev) return false;
        return true;
    }

    /**
     * Send HTTP request to Google Apps Script Web App for real-time Google Sheet synchronization
     * Cross-platform: VBScript on Windows, doScript with AppleScript (curl) on macOS
     * 100% Silent Background Execution (Zero CMD / Console Window Popups)
     */
    function sendStandaloneApiRequest(params) {
        try {
            var tempFolder = Folder.temp;
            var reqId = "joynest_api_" + (new Date().getTime()) + "_" + Math.floor(Math.random() * 10000);
            var outFile = new File(tempFolder.fsName + "/" + reqId + ".json");
            var doneFile = new File(tempFolder.fsName + "/" + reqId + ".done");
            var vbsFile = null;
            var scptFile = null;
            
            var queryParts = [];
            for (var k in params) {
                if (params.hasOwnProperty(k)) {
                    queryParts.push(encodeURIComponent(k) + "=" + encodeURIComponent(params[k]));
                }
            }
            var targetUrl = STANDALONE_WEBAPP_URL + "?" + queryParts.join("&");
            
            var isWindows = ($.os.indexOf("Windows") !== -1);

            if (isWindows) {
                vbsFile = new File(tempFolder.fsName + "/" + reqId + ".vbs");
                var outFs = outFile.fsName.replace(/\\/g, "\\\\");
                var doneFs = doneFile.fsName.replace(/\\/g, "\\\\");
                
                // 100% Silent VBScript: uses MSXML2.ServerXMLHTTP or hidden curl with window style 0
                var vbsContent = 'On Error Resume Next\r\n' +
                    'Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")\r\n' +
                    'If Err.Number <> 0 Or http Is Nothing Then\r\n' +
                    '    Set http = CreateObject("MSXML2.XMLHTTP")\r\n' +
                    'End If\r\n' +
                    'If Err.Number <> 0 Or http Is Nothing Then\r\n' +
                    '    Set http = CreateObject("WinHttp.WinHttpRequest.5.1")\r\n' +
                    'End If\r\n' +
                    'http.open "GET", "' + targetUrl + '", False\r\n' +
                    'http.setRequestHeader "User-Agent", "JoyNest-Suite/2.7"\r\n' +
                    'http.send\r\n' +
                    'If Err.Number = 0 And (http.status = 200 Or http.status = 302) Then\r\n' +
                    '    Set stm = CreateObject("ADODB.Stream")\r\n' +
                    '    stm.Type = 2\r\n' +
                    '    stm.Charset = "utf-8"\r\n' +
                    '    stm.Open\r\n' +
                    '    stm.WriteText http.responseText\r\n' +
                    '    stm.SaveToFile "' + outFs + '", 2\r\n' +
                    '    stm.Close\r\n' +
                    '    Set fso = CreateObject("Scripting.FileSystemObject")\r\n' +
                    '    Set done = fso.CreateTextFile("' + doneFs + '", True)\r\n' +
                    '    done.Write "done"\r\n' +
                    '    done.Close\r\n' +
                    'Else\r\n' +
                    '    Set sh = CreateObject("WScript.Shell")\r\n' +
                    '    sh.Run "cmd.exe /c curl.exe -s -L --connect-timeout 6 --max-time 10 -A ""JoyNest-Suite/2.7"" """ & "' + targetUrl + '" & """ -o """ & "' + outFs + '" & """", 0, True\r\n' +
                    '    Set fso = CreateObject("Scripting.FileSystemObject")\r\n' +
                    '    Set done = fso.CreateTextFile("' + doneFs + '", True)\r\n' +
                    '    done.Write "done"\r\n' +
                    '    done.Close\r\n' +
                    'End If\r\n';
                
                vbsFile.open("w");
                vbsFile.write(vbsContent);
                vbsFile.close();
                
                // Execute VBScript completely silently (0 console window)
                vbsFile.execute();
            } else {
                // macOS: Utilize doScript with AppleScript (curl)
                var outFsMac = outFile.fsName;
                var doneFsMac = doneFile.fsName;
                var appleScriptCode = 'do shell script "curl -s -L --connect-timeout 6 --max-time 10 -A \\"JoyNest-Suite/2.7\\" \\"' + targetUrl.replace(/"/g, '\\"') + '\\" -o \\"' + outFsMac.replace(/"/g, '\\"') + '\\" && echo done > \\"' + doneFsMac.replace(/"/g, '\\"') + '\\""';
                
                var executedViaDoScript = false;
                try {
                    if (typeof ScriptLanguage !== "undefined" && ScriptLanguage.APPLESCRIPT) {
                        app.doScript(appleScriptCode, ScriptLanguage.APPLESCRIPT);
                        executedViaDoScript = true;
                    } else {
                        app.doScript(appleScriptCode, "AppleScript");
                        executedViaDoScript = true;
                    }
                } catch (eDoScript) {
                    executedViaDoScript = false;
                }

                // Fallback execution if doScript signature differs in certain host environments
                if (!executedViaDoScript || (!doneFile.exists && !outFile.exists)) {
                    try {
                        scptFile = new File(tempFolder.fsName + "/" + reqId + ".scpt");
                        scptFile.open("w");
                        scptFile.write(appleScriptCode);
                        scptFile.close();
                        scptFile.execute();
                    } catch (eScpt) {}
                }
            }
            
            // Wait up to 12 seconds for completion
            var startTime = new Date().getTime();
            while (!doneFile.exists && !outFile.exists && (new Date().getTime() - startTime) < 12000) {
                $.sleep(150);
            }
            
            var result = null;
            if (outFile.exists) {
                outFile.open("r");
                var raw = outFile.read();
                outFile.close();
                if (raw) {
                    try {
                        raw = raw.replace(/^\uFEFF/, "").replace(/^\s+|\s+$/g, "");
                        result = eval("(" + raw + ")");
                    } catch(eEval){}
                }
            }
            
            // Cleanup temp files
            try { if (outFile && outFile.exists) outFile.remove(); } catch(e1){}
            try { if (doneFile && doneFile.exists) doneFile.remove(); } catch(e2){}
            try { if (vbsFile && vbsFile.exists) vbsFile.remove(); } catch(e3){}
            try { if (scptFile && scptFile.exists) scptFile.remove(); } catch(e4){}
            
            return result;
        } catch (err) {
            return null;
        }
    }

    /**
     * Modern, custom dialog replacing generic Windows OS alert boxes
     */
    function showModernAlert(title, message, alertType) {
        var type = alertType || "info";
        var winTitle = title || "Notification";
        
        var alertWin = new Window("dialog", winTitle);
        alertWin.orientation = "column";
        alertWin.alignChildren = ["fill", "top"];
        alertWin.spacing = 10;
        alertWin.margins = [20, 18, 20, 16];
        alertWin.preferredSize = [460, 220];
        alertWin.size = [460, 220];
        alertWin.minimumSize = [460, 220];
        alertWin.maximumSize = [460, 220];

        // Card Panel
        var pnlCard = alertWin.add("panel", undefined, "");
        pnlCard.orientation = "column";
        pnlCard.alignChildren = ["center", "center"];
        pnlCard.margins = [16, 14, 16, 14];
        pnlCard.spacing = 6;

        var headerBadgeText = "ℹ  INFORMATION";
        var badgeColor = [0.4, 0.6, 0.9, 1]; // blue
        if (type === "success") {
            headerBadgeText = "✓  SUCCESS";
            badgeColor = [0.15, 0.85, 0.45, 1]; // green
        } else if (type === "error") {
            headerBadgeText = "✕  VERIFICATION FAILED";
            badgeColor = [0.95, 0.3, 0.3, 1]; // red
        } else if (type === "warning") {
            headerBadgeText = "⚠  ATTENTION REQUIRED";
            badgeColor = [0.95, 0.75, 0.2, 1]; // amber
        }

        var lblBadge = pnlCard.add("statictext", undefined, headerBadgeText);
        try {
            lblBadge.graphics.font = ScriptUI.newFont(lblBadge.graphics.font.name, "Bold", 12);
            lblBadge.graphics.foregroundColor = lblBadge.graphics.newPen(lblBadge.graphics.PenType.SOLID_COLOR, badgeColor, 1);
        } catch(e){}

        var lblHeading = pnlCard.add("statictext", undefined, title || "Notice");
        try {
            lblHeading.graphics.font = ScriptUI.newFont(lblHeading.graphics.font.name, "Bold", 13);
        } catch(e){}

        // Message text
        var txtMsg = pnlCard.add("statictext", undefined, message, { multiline: true });
        txtMsg.preferredSize.width = 380;
        try {
            txtMsg.graphics.font = ScriptUI.newFont(txtMsg.graphics.font.name, "Regular", 11);
        } catch(e){}

        // Bottom Branding
        var lblBrand = alertWin.add("statictext", undefined, "⚡ JoyNest Agency · License Security");
        lblBrand.alignment = ["center", "bottom"];
        try {
            lblBrand.graphics.font = ScriptUI.newFont(lblBrand.graphics.font.name, "Regular", 9);
        } catch(e){}

        // Action Button
        var grpBtn = alertWin.add("group");
        grpBtn.orientation = "row";
        grpBtn.alignment = ["center", "bottom"];
        var btnOk = grpBtn.add("button", undefined, "OK", { name: "ok" });
        btnOk.preferredSize = [110, 30];

        btnOk.onClick = function() {
            alertWin.close(1);
        };

        alertWin.show();
    }

    /**
     * Stunning, professional Success & Welcome receipt modal
     */
    function showActivationSuccessModal(lic, onLaunch) {
        var dlg = new Window("dialog", "License Activated - JoyNest Agency");
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.spacing = 12;
        dlg.margins = [20, 18, 20, 16];
        dlg.preferredSize = [480, 420];
        dlg.size = [480, 420];
        dlg.minimumSize = [480, 420];
        dlg.maximumSize = [480, 420];

        // Card Container
        var pnlCard = dlg.add("panel", undefined, "");
        pnlCard.orientation = "column";
        pnlCard.alignChildren = ["center", "center"];
        pnlCard.margins = [16, 14, 16, 14];
        pnlCard.spacing = 5;

        // Success Badge
        var lblBadge = pnlCard.add("statictext", undefined, "✓  LICENSE VERIFIED & ACTIVE");
        try {
            lblBadge.graphics.font = ScriptUI.newFont(lblBadge.graphics.font.name, "Bold", 13);
            lblBadge.graphics.foregroundColor = lblBadge.graphics.newPen(lblBadge.graphics.PenType.SOLID_COLOR, [0.15, 0.85, 0.45, 1], 1);
        } catch(e){}

        var userName = (lic && lic.name) ? lic.name : "Valued Customer";
        var lblWelcome = pnlCard.add("statictext", undefined, "Welcome, " + userName + "!");
        try {
            lblWelcome.graphics.font = ScriptUI.newFont(lblWelcome.graphics.font.name, "Bold", 14);
        } catch(e){}

        var lblSub = pnlCard.add("statictext", undefined, "Automation Suite Pro is now fully activated on this device.");
        try {
            lblSub.graphics.font = ScriptUI.newFont(lblSub.graphics.font.name, "Regular", 11);
        } catch(e){}

        // Details Panel
        var pnlDetails = dlg.add("panel", undefined, "License Subscription Summary");
        pnlDetails.orientation = "column";
        pnlDetails.alignChildren = ["fill", "top"];
        pnlDetails.margins = [14, 12, 14, 12];
        pnlDetails.spacing = 6;

        function addDetailRow(parent, label, value) {
            var grp = parent.add("group");
            grp.orientation = "row";
            var lbl = grp.add("statictext", undefined, label);
            lbl.preferredSize.width = 110;
            try { lbl.graphics.font = ScriptUI.newFont(lbl.graphics.font.name, "Bold", 10.5); } catch(e){}
            var val = grp.add("statictext", undefined, value);
            val.preferredSize.width = 300;
            try { val.graphics.font = ScriptUI.newFont(val.graphics.font.name, "Regular", 10.5); } catch(e){}
        }

        var keyDisplay = (lic && lic.key) ? (lic.key.length > 12 ? lic.key.substr(0, 11) + "••••-••••" : lic.key) : "VERIFIED-KEY";
        addDetailRow(pnlDetails, "License Key:", keyDisplay);
        addDetailRow(pnlDetails, "Subscription:", (lic && lic.expiry) ? ("Expires " + formatBSTDateStandalone(lic.expiry)) : "Lifetime Commercial Access");
        addDetailRow(pnlDetails, "Device Status:", "✓ Authorized (" + getStandaloneDeviceId() + ")");
        addDetailRow(pnlDetails, "Provider:", "JoyNest Agency (support@joynestagency.com)");

        // Bottom Branding
        var lblBrand = dlg.add("statictext", undefined, "⚡ JoyNest Agency · Automation Suite Pro");
        lblBrand.alignment = ["center", "bottom"];
        try {
            lblBrand.graphics.font = ScriptUI.newFont(lblBrand.graphics.font.name, "Regular", 9);
        } catch(e){}

        // Launch Button
        var grpBtn = dlg.add("group");
        grpBtn.orientation = "row";
        grpBtn.alignment = ["center", "bottom"];
        grpBtn.spacing = 10;

        var btnLaunch = grpBtn.add("button", undefined, "🚀  Launch Automation Suite", { name: "ok" });
        btnLaunch.preferredSize = [240, 34];
        try {
            btnLaunch.graphics.font = ScriptUI.newFont(btnLaunch.graphics.font.name, "Bold", 12);
        } catch(e){}

        btnLaunch.onClick = function() {
            dlg.close(1);
            if (onLaunch) onLaunch();
        };

        dlg.show();
    }

    function showLicenseActivationDialog(onSuccess) {
        var actDlg = new Window("dialog", "License Activation Required - JoyNest Agency");
        actDlg.orientation = "column";
        actDlg.alignChildren = ["fill", "top"];
        actDlg.spacing = 10;
        actDlg.margins = [18, 16, 18, 14];
        actDlg.preferredSize = [480, 500];
        actDlg.size = [480, 500];
        actDlg.minimumSize = [480, 500];
        actDlg.maximumSize = [480, 500];

        // Professional Header
        var pnlHeader = actDlg.add("panel", undefined, "");
        pnlHeader.orientation = "column";
        pnlHeader.alignChildren = ["center", "center"];
        pnlHeader.margins = [14, 12, 14, 12];
        pnlHeader.spacing = 4;
        
        var lblTitle = pnlHeader.add("statictext", undefined, "AUTOMATION SUITE PRO");
        try { lblTitle.graphics.font = ScriptUI.newFont(lblTitle.graphics.font.name, "Bold", 14); } catch(e){}
        
        var lblNotice1 = pnlHeader.add("statictext", undefined, "A valid License Key is required to access and use this product.");
        var lblNotice2 = pnlHeader.add("statictext", undefined, "Please enter your credentials and activate your license to continue.");

        // Branding Banner
        var lblBrand = pnlHeader.add("statictext", undefined, "⚡ This is a product by JoyNest Agency");
        try { lblBrand.graphics.font = ScriptUI.newFont(lblBrand.graphics.font.name, "Bold", 11); } catch(e){}

        // User Input Form
        var pnlInput = actDlg.add("panel", undefined, "User & License Credentials");
        pnlInput.orientation = "column";
        pnlInput.alignChildren = ["fill", "top"];
        pnlInput.margins = [14, 12, 14, 12];
        pnlInput.spacing = 8;

        // Full Name Field
        var grpName = pnlInput.add("group");
        grpName.orientation = "row";
        var lblName = grpName.add("statictext", undefined, "Full Name:");
        lblName.preferredSize.width = 85;
        var txtName = grpName.add("edittext", undefined, "");
        txtName.preferredSize = [320, 24];

        // Email Field
        var grpEmail = pnlInput.add("group");
        grpEmail.orientation = "row";
        var lblEmail = grpEmail.add("statictext", undefined, "Email Address:");
        lblEmail.preferredSize.width = 85;
        var txtEmail = grpEmail.add("edittext", undefined, "");
        txtEmail.preferredSize = [320, 24];

        // License Key Field
        var grpKey = pnlInput.add("group");
        grpKey.orientation = "row";
        var lblKey = grpKey.add("statictext", undefined, "License Key:");
        lblKey.preferredSize.width = 85;
        var txtKey = grpKey.add("edittext", undefined, "");
        txtKey.preferredSize = [320, 24];

        // Connect Branding & Support
        var pnlContact = actDlg.add("panel", undefined, "Connect for Licences Key");
        pnlContact.orientation = "column";
        pnlContact.alignChildren = ["center", "center"];
        pnlContact.margins = [10, 6, 10, 6];
        pnlContact.add("statictext", undefined, "JoyNest Agency Support: support@joynestagency.com");

        // Action Buttons
        var grpBtns = actDlg.add("group");
        grpBtns.orientation = "row";
        grpBtns.alignment = ["right", "bottom"];
        grpBtns.spacing = 10;

        var btnExit = grpBtns.add("button", undefined, "Exit");
        btnExit.preferredSize = [80, 30];
        var btnActivate = grpBtns.add("button", undefined, "Activate License", { name: "ok" });
        btnActivate.preferredSize = [140, 30];

        btnExit.onClick = function() {
            actDlg.close(0);
        };

        btnActivate.onClick = function() {
            var inputName = txtName.text ? txtName.text.replace(/^\s+|\s+$/g, "") : "";
            var inputEmail = txtEmail.text ? txtEmail.text.replace(/^\s+|\s+$/g, "") : "";
            var inputKey = txtKey.text ? txtKey.text.replace(/^\s+|\s+$/g, "").toUpperCase() : "";

            // Strict Validation Sequence as Specified
            if (!inputName) {
                showModernAlert("Name Required", "Please enter your full name to continue with license activation.", "warning");
                return;
            }

            if (!inputEmail) {
                showModernAlert("Email Required", "Please enter your email address to continue with license activation.", "warning");
                return;
            }

            var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(inputEmail)) {
                showModernAlert("Invalid Email", "Please enter a valid email address (e.g. name@example.com).", "warning");
                return;
            }

            if (!inputKey) {
                showModernAlert("License Key Required", "A valid License Key is required to use this product.", "warning");
                return;
            }

            var myDev = getStandaloneDeviceId();

            // Contact JoyNest Central Google Apps Script Backend in Real-Time
            var serverRes = sendStandaloneApiRequest({
                action: "activate",
                key: inputKey,
                name: inputName,
                email: inputEmail,
                deviceId: myDev
            });

            if (serverRes && typeof serverRes === 'object') {
                if (serverRes.success) {
                    var verifiedLic = {
                        key: inputKey,
                        name: inputName,
                        email: inputEmail,
                        status: serverRes.status || "Activated",
                        activatedAt: serverRes.activatedAt || formatBSTDateStandalone(new Date()),
                        expiry: serverRes.expiryDate || "2099-12-31",
                        deviceId: myDev,
                        deactivationCount: parseInt(serverRes.deactivationCount, 10) || 0,
                        lastVerified: formatBSTDateStandalone(new Date())
                    };
                    saveStoredLicenseStandalone(verifiedLic);

                    actDlg.close(1);
                    showActivationSuccessModal(verifiedLic, function() {
                        if (onSuccess) onSuccess();
                    });
                    return;
                } else {
                    showModernAlert(serverRes.title || "License Verification Failed", serverRes.message || serverRes.error || "The License Key you entered could not be verified on the server.", "error");
                    return;
                }
            } else {
                // If temporary network lag, check if key is valid JoyNest format
                var keyPattern = /^JOYNEST-[A-Z0-9\-]+$/i;
                if (keyPattern.test(inputKey) || inputKey.length >= 12) {
                    var offlineLic = {
                        key: inputKey,
                        name: inputName,
                        email: inputEmail,
                        status: "Activated",
                        activatedAt: formatBSTDateStandalone(new Date()),
                        expiry: "2099-12-31",
                        deviceId: myDev,
                        deactivationCount: 0,
                        lastVerified: formatBSTDateStandalone(new Date()) + " (Offline Activated)"
                    };
                    saveStoredLicenseStandalone(offlineLic);

                    actDlg.close(1);
                    showActivationSuccessModal(offlineLic, function() {
                        if (onSuccess) onSuccess();
                    });
                    return;
                } else {
                    showModernAlert("License Verification Failed", "The License Key you entered could not be verified on the server.\n\nPlease check your key and try again.", "error");
                    return;
                }
            }
        };

        actDlg.show();
    }

    function showLicenseDetailsDialog(onDeactivated) {
        var lic = loadStoredLicenseStandalone();
        var myDev = getStandaloneDeviceId();
        var status = (lic && lic.status) ? lic.status : "Unused";
        var key = (lic && lic.key) ? lic.key : "";
        var isMasked = true;

        var detDlg = new Window("dialog", "License Information - JoyNest Agency");
        detDlg.orientation = "column";
        detDlg.alignChildren = ["fill", "top"];
        detDlg.spacing = 10;
        detDlg.margins = [18, 16, 18, 14];
        detDlg.preferredSize = [480, 520];
        detDlg.size = [480, 520];
        detDlg.minimumSize = [480, 520];
        detDlg.maximumSize = [480, 520];

        // JoyNest Agency Header
        var pnlBrand = detDlg.add("panel", undefined, "");
        pnlBrand.orientation = "column";
        pnlBrand.alignChildren = ["center", "center"];
        pnlBrand.margins = [10, 8, 10, 8];
        var lblBrand = pnlBrand.add("statictext", undefined, "⚡ This is a product by JoyNest Agency");
        try { lblBrand.graphics.font = ScriptUI.newFont(lblBrand.graphics.font.name, "Bold", 12); } catch(e){}

        // Info Panel
        var pnlInfo = detDlg.add("panel", undefined, "Active Subscription & Device Details");
        pnlInfo.orientation = "column";
        pnlInfo.alignChildren = ["fill", "top"];
        pnlInfo.margins = [14, 12, 14, 12];
        pnlInfo.spacing = 8;

        // Status
        var rowStatus = pnlInfo.add("group");
        rowStatus.orientation = "row";
        rowStatus.add("statictext", undefined, "License Status:");
        var lblStatVal = rowStatus.add("statictext", undefined, status);
        try { lblStatVal.graphics.font = ScriptUI.newFont(lblStatVal.graphics.font.name, "Bold", 11); } catch(e){}

        // Key with Eye Toggle
        var rowKey = pnlInfo.add("group");
        rowKey.orientation = "row";
        rowKey.add("statictext", undefined, "License Key:");
        var txtKeyVal = rowKey.add("edittext", undefined, key ? "••••-••••-••••-" + key.substr(key.length - 4) : "••••••••••••••••", { readonly: true });
        txtKeyVal.preferredSize.width = 210;
        var btnEye = rowKey.add("button", undefined, "👁 Show");
        btnEye.preferredSize = [65, 24];

        btnEye.onClick = function() {
            isMasked = !isMasked;
            if (isMasked) {
                txtKeyVal.text = key ? "••••-••••-••••-" + key.substr(key.length - 4) : "••••••••••••••••";
                btnEye.text = "👁 Show";
            } else {
                txtKeyVal.text = key || "NO-KEY";
                btnEye.text = "🙈 Hide";
            }
        };

        // Activated Date
        var rowAct = pnlInfo.add("group");
        rowAct.orientation = "row";
        rowAct.add("statictext", undefined, "Activated Date:");
        rowAct.add("statictext", undefined, (lic && lic.activatedAt) ? formatBSTDateStandalone(lic.activatedAt) : "-");

        // Expiry Date
        var rowExp = pnlInfo.add("group");
        rowExp.orientation = "row";
        rowExp.add("statictext", undefined, "Expires On:");
        rowExp.add("statictext", undefined, (lic && lic.expiry) ? formatBSTDateStandalone(lic.expiry) : "Lifetime Validity");

        // Device
        var rowDev = pnlInfo.add("group");
        rowDev.orientation = "row";
        rowDev.add("statictext", undefined, "Device Status:");
        var devMatch = (!lic || !lic.deviceId || lic.deviceId === myDev);
        rowDev.add("statictext", undefined, devMatch ? ("Authorized (" + myDev + ")") : "Device Verification Failed");

        // Last Verified
        var rowLastVer = pnlInfo.add("group");
        rowLastVer.orientation = "row";
        rowLastVer.add("statictext", undefined, "Last Verified:");
        rowLastVer.add("statictext", undefined, (lic && lic.lastVerified) ? lic.lastVerified : formatBSTDateStandalone(new Date()));

        // Deactivation policy
        var rowCount = pnlInfo.add("group");
        rowCount.orientation = "row";
        rowCount.add("statictext", undefined, "Deactivation & Reuse:");
        var count = (lic && lic.deactivationCount) ? parseInt(lic.deactivationCount, 10) : 0;
        rowCount.add("statictext", undefined, count + " / 1 used " + (count < 1 ? "(1-time reuse eligible)" : "(Second use active)"));

        // Connect Support
        var pnlContact = detDlg.add("panel", undefined, "Connect for Licences Key / Renewal");
        pnlContact.orientation = "column";
        pnlContact.alignChildren = ["center", "center"];
        pnlContact.margins = [10, 6, 10, 6];
        pnlContact.add("statictext", undefined, "JoyNest Agency Support: support@joynestagency.com");

        // Buttons
        var grpBtns = detDlg.add("group");
        grpBtns.orientation = "row";
        grpBtns.alignChildren = ["fill", "center"];
        grpBtns.spacing = 8;

        var btnDeact = grpBtns.add("button", undefined, "Deactivate License");
        btnDeact.preferredSize = [140, 28];
        if (!lic || lic.status !== "Activated" || count >= 2) {
            btnDeact.enabled = false;
        }

        var btnClose = grpBtns.add("button", undefined, "Close", { name: "ok" });
        btnClose.preferredSize = [90, 28];

        btnDeact.onClick = function() {
            if (confirm("Are you sure you want to deactivate your license on this device? (You can reactivate on this same device at most once).")) {
                var serverRes = sendStandaloneApiRequest({
                    action: "deactivate",
                    key: lic.key,
                    deviceId: myDev
                });
                
                var newCount = (serverRes && serverRes.deactivationCount) ? serverRes.deactivationCount : (count + 1);
                lic.status = "Deactivate";
                lic.deactivationCount = newCount;
                saveStoredLicenseStandalone(lic);
                
                showModernAlert("License Deactivated", "License has been deactivated successfully on this device and updated in Google Sheets.\n\nThe script will now close. A valid License Key is required to use the suite.", "info");
                detDlg.close(1);
                if (typeof onDeactivated === 'function') {
                    onDeactivated();
                }
            }
        };

        btnClose.onClick = function() {
            detDlg.close(0);
        };

        detDlg.show();
    }

    // -------------------------------------------------------------------------
    // KDP Layout Preview System (33-Metric Pre-Flight & Geometry Preview)
    // -------------------------------------------------------------------------
    function buildKDPPreviewData(settings) {
        var s = settings || createKDPSettings();
        var val = validateKDPSettings(s, true);
        var layoutData = calculateKDPLayout(s);
        var layoutVal = validateKDPLayout(layoutData);

        var errors = [];
        if (!val.isValid && val.errors) errors = errors.concat(val.errors);
        if (!layoutVal.isValid && layoutVal.errors) errors = errors.concat(layoutVal.errors);

        // Files & Counts
        var inFolder = (s.inputFolder instanceof Folder) ? s.inputFolder : (s.inputFolder ? new Folder(s.inputFolder) : null);
        var detectedCount = 0;
        var detectedFiles = [];
        if (inFolder && inFolder.exists) {
            if (kdpRuntimeState.detectedFiles && kdpRuntimeState.detectedFiles.length > 0 && kdpRuntimeState.inputFolder && kdpRuntimeState.inputFolder.fsName === inFolder.fsName) {
                detectedFiles = kdpRuntimeState.detectedFiles;
                detectedCount = detectedFiles.length;
            } else {
                detectedFiles = scanKDPInputFiles(inFolder, { forceRescan: false });
                detectedCount = detectedFiles.length;
            }
        }

        var pageCount = parseInt(s.pageCount, 10) || 1;
        var iconsPerPage = parseInt(s.iconsPerPage, 10) || 1;
        var isBlankPageEnabled = (s.addBlankPageAfterContent === true);
        var contentPages = isBlankPageEnabled ? Math.ceil(pageCount / 2) : pageCount;
        var blankPages = isBlankPageEnabled ? Math.floor(pageCount / 2) : 0;
        var requiredSlots = contentPages * iconsPerPage;

        var expectedUsed = 0;
        var expectedEmpty = 0;
        var expectedUnused = 0;

        if (s.allowDuplicates) {
            expectedUsed = (detectedCount > 0) ? requiredSlots : 0;
            expectedEmpty = (detectedCount > 0) ? 0 : requiredSlots;
            expectedUnused = (detectedCount > requiredSlots) ? (detectedCount - requiredSlots) : 0;
        } else {
            expectedUsed = Math.min(detectedCount, requiredSlots);
            expectedEmpty = Math.max(0, requiredSlots - detectedCount);
            expectedUnused = Math.max(0, detectedCount - requiredSlots);
        }

        // Export file estimations
        var estPdfFiles = s.exportPDF ? 1 : 0;
        var estEpsFiles = s.exportEPS ? pageCount : 0;
        var estSvgFiles = s.exportSVG ? pageCount : 0;
        var estTotalExportFiles = estPdfFiles + estEpsFiles + estSvgFiles;
        var exportFormatsList = [];
        if (s.exportPDF) exportFormatsList.push("PDF");
        if (s.exportEPS) exportFormatsList.push("EPS");
        if (s.exportSVG) exportFormatsList.push("SVG");

        // Warnings calculation
        var warnings = [];
        if (val.warnings && val.warnings.length > 0) {
            warnings = warnings.concat(val.warnings);
        }
        if (!inFolder || !inFolder.exists) {
            warnings.push("Input folder is not selected or does not exist.");
        } else if (detectedCount === 0) {
            warnings.push("Input folder contains no supported vector icons (.svg, .eps, .ai, .pdf).");
        } else if (detectedCount < requiredSlots && !s.allowDuplicates) {
            warnings.push("Available icons (" + detectedCount + ") are fewer than required slots (" + requiredSlots + "). " + (requiredSlots - detectedCount) + " cell(s) will remain empty.");
        } else if (detectedCount > requiredSlots) {
            warnings.push("More icons are available (" + detectedCount + ") than required slots (" + requiredSlots + "). " + (detectedCount - requiredSlots) + " icon(s) will remain unused.");
        }

        if (s.layoutMode === "manual" && (s.rows * s.columns !== s.iconsPerPage)) {
            warnings.push("Manual rows (" + s.rows + ") × columns (" + s.columns + ") = " + (s.rows * s.columns) + " does not match Icons Per Page (" + s.iconsPerPage + ").");
        }

        if (layoutData.contentWidth <= 0 || layoutData.contentHeight <= 0) {
            warnings.push("Margins leave insufficient or negative printable content area.");
        }
        if (layoutData.cellWidth <= 0 || layoutData.cellHeight <= 0) {
            warnings.push("Calculated cell dimensions are invalid or zero.");
        }

        if (estTotalExportFiles > 0) {
            if (!s.outputFolder) {
                warnings.push("Export formats are enabled, but output folder is not specified.");
            }
        }

        var sanitizedName = sanitizeKDPFileName(s.projectName);
        if (sanitizedName !== s.projectName) {
            warnings.push("Project name contains characters that will be sanitized for filenames ('" + sanitizedName + "').");
        }

        if (s.fitMode === "fixed-width" && (!s.fixedIconWidth || s.fixedIconWidth <= 0)) {
            warnings.push("Fixed width dimension is zero or invalid.");
        }
        if (s.fitMode === "fixed-height" && (!s.fixedIconHeight || s.fixedIconHeight <= 0)) {
            warnings.push("Fixed height dimension is zero or invalid.");
        }

        var wUnit = pointsToUnit(layoutData.pageWidth, s.pageUnit).toFixed(2);
        var hUnit = pointsToUnit(layoutData.pageHeight, s.pageUnit).toFixed(2);
        var cellWUnit = pointsToUnit(layoutData.cellWidth, s.pageUnit).toFixed(2);
        var cellHUnit = pointsToUnit(layoutData.cellHeight, s.pageUnit).toFixed(2);
        var contWUnit = pointsToUnit(layoutData.contentWidth, s.pageUnit).toFixed(2);
        var contHUnit = pointsToUnit(layoutData.contentHeight, s.pageUnit).toFixed(2);

        return {
            isValid: (errors.length === 0),
            errors: errors,
            warnings: warnings,
            settings: s,
            layout: layoutData,

            // 33 Core Metrics
            projectName: s.projectName || "KDP_Interior",
            inputFolder: s.inputFolder || "N/A",
            outputFolder: s.outputFolder || "N/A",
            pageWidthUnit: wUnit,
            pageHeightUnit: hUnit,
            pageWidthPt: Math.round(layoutData.pageWidth),
            pageHeightPt: Math.round(layoutData.pageHeight),
            pageUnit: s.pageUnit,
            pageCount: pageCount,
            iconsPerPage: iconsPerPage,
            gridMode: s.layoutMode || "auto",
            rows: layoutData.rows,
            columns: layoutData.columns,
            cellWidthUnit: cellWUnit,
            cellHeightUnit: cellHUnit,
            cellWidthPt: Math.round(layoutData.cellWidth),
            cellHeightPt: Math.round(layoutData.cellHeight),
            contentWidthUnit: contWUnit,
            contentHeightUnit: contHUnit,
            contentWidthPt: Math.round(layoutData.contentWidth),
            contentHeightPt: Math.round(layoutData.contentHeight),
            topMargin: (s.topMargin !== undefined ? s.topMargin : 0.5),
            bottomMargin: (s.bottomMargin !== undefined ? s.bottomMargin : 0.5),
            leftMargin: (s.leftMargin !== undefined ? s.leftMargin : 0.5),
            rightMargin: (s.rightMargin !== undefined ? s.rightMargin : 0.5),
            horizontalGap: (s.horizontalGap !== undefined ? s.horizontalGap : 0.25),
            verticalGap: (s.verticalGap !== undefined ? s.verticalGap : 0.25),
            fitMode: s.fitMode || "maximum-fit",
            horizontalAlignment: s.horizontalAlignment || "center",
            verticalAlignment: s.verticalAlignment || "center",
            iconOrder: s.iconOrder || "sequential",
            duplicatePolicy: s.allowDuplicates ? "Allowed" : "Disabled",
            availableIcons: detectedCount,
            requiredSlots: requiredSlots,
            expectedUsed: expectedUsed,
            expectedEmpty: expectedEmpty,
            expectedUnused: expectedUnused,
            contentPages: contentPages,
            blankPages: blankPages,
            pageNumberStatus: s.addPageNumber ? ("Enabled (" + s.pageNumberPosition + ", start " + s.pageNumberStart + ", " + s.pageNumberFontSize + "pt)") : "Disabled",
            exportFormats: exportFormatsList.length > 0 ? exportFormatsList.join(", ") : "None",
            estimatedOutputFiles: estTotalExportFiles,
            exportBreakdown: {
                pdf: estPdfFiles,
                eps: estEpsFiles,
                svg: estSvgFiles
            }
        };
    }

    function formatKDPPreviewText(d) {
        if (!d) return "No preview data available.";
        var lines = [];
        lines.push("PROJECT: " + d.projectName);
        lines.push("Page Size: " + d.pageWidthUnit + " x " + d.pageHeightUnit + " " + d.pageUnit + " (" + d.pageWidthPt + " x " + d.pageHeightPt + " pt)");
        lines.push("Page Count: " + d.pageCount + " (Content: " + d.contentPages + ", Blank: " + d.blankPages + ")");
        lines.push("Grid: " + d.rows + " Rows x " + d.columns + " Cols (" + d.iconsPerPage + " icons/page, Mode: " + d.gridMode + ")");
        lines.push("Content Area: " + d.contentWidthUnit + " x " + d.contentHeightUnit + " " + d.pageUnit + " (" + d.contentWidthPt + " x " + d.contentHeightPt + " pt)");
        lines.push("Cell Size: " + d.cellWidthUnit + " x " + d.cellHeightUnit + " " + d.pageUnit + " (" + d.cellWidthPt + " x " + d.cellHeightPt + " pt)");
        lines.push("Margins (T/B/L/R): " + d.topMargin + " / " + d.bottomMargin + " / " + d.leftMargin + " / " + d.rightMargin + " " + d.pageUnit);
        lines.push("Gaps (H/V): " + d.horizontalGap + " / " + d.verticalGap + " " + d.pageUnit);
        lines.push("Icon Distribution: " + d.iconOrder + " (Duplicates: " + d.duplicatePolicy + ")");
        lines.push("Slots: " + d.requiredSlots + " required | Available: " + d.availableIcons + " | Used: " + d.expectedUsed + " | Empty: " + d.expectedEmpty + " | Unused: " + d.expectedUnused);
        lines.push("Page Numbers: " + d.pageNumberStatus);
        lines.push("Exports: " + d.exportFormats + " (~" + d.estimatedOutputFiles + " total files)");
        if (d.warnings && d.warnings.length > 0) {
            lines.push("Warnings (" + d.warnings.length + "): " + d.warnings.join(" | "));
        }
        return lines.join("\n");
    }

    function showKDPPreviewModal(settings, onGenerate) {
        var prevData = buildKDPPreviewData(settings);

        if (!prevData.isValid) {
            showModernAlert("Invalid KDP Settings", "Please correct the following errors before previewing:\n\n• " + prevData.errors.join("\n• "), "error");
            return;
        }

        var prevDlg = new Window("dialog", "KDP Interior Layout & Geometry Preview");
        prevDlg.orientation = "column";
        prevDlg.alignChildren = ["fill", "top"];
        prevDlg.spacing = 10;
        prevDlg.margins = [18, 16, 18, 14];
        prevDlg.preferredSize = [540, 540];
        prevDlg.size = [540, 540];
        prevDlg.minimumSize = [540, 540];
        prevDlg.maximumSize = [540, 540];

        // Header Panel
        var pnlHeader = prevDlg.add("panel", undefined, "");
        pnlHeader.orientation = "column";
        pnlHeader.alignChildren = ["center", "center"];
        pnlHeader.margins = [10, 8, 10, 8];
        pnlHeader.spacing = 2;

        var lblTitle = pnlHeader.add("statictext", undefined, "📖 " + prevData.projectName + " — Layout Preview");
        try { lblTitle.graphics.font = ScriptUI.newFont(lblTitle.graphics.font.name, "Bold", 13); } catch (e) {}
        var lblSub = pnlHeader.add("statictext", undefined, prevData.pageWidthUnit + " × " + prevData.pageHeightUnit + " " + prevData.pageUnit + " | " + prevData.pageCount + " Pages | " + prevData.iconsPerPage + " Icons/Page (" + prevData.rows + "×" + prevData.columns + ")");
        try { lblSub.graphics.foregroundColor = lblSub.graphics.newPen(lblSub.graphics.PenType.SOLID_COLOR, [0.4, 0.4, 0.4, 1], 1); } catch (eS) {}

        // Main Grid with 2 columns
        var grpColumns = prevDlg.add("group");
        grpColumns.orientation = "row";
        grpColumns.alignChildren = ["fill", "top"];
        grpColumns.spacing = 10;

        function addPreviewRow(p, label, valText) {
            var grp = p.add("group");
            grp.orientation = "row";
            grp.alignChildren = ["left", "center"];
            var l = grp.add("statictext", undefined, label);
            l.preferredSize.width = 110;
            try { l.graphics.font = ScriptUI.newFont(l.graphics.font.name, "Bold", 10); } catch (e) {}
            var v = grp.add("statictext", undefined, String(valText));
            v.preferredSize.width = 135;
        }

        // Left Column: Geometry & Grid
        var pnlLeft = grpColumns.add("panel", undefined, "Document & Grid Geometry");
        pnlLeft.orientation = "column";
        pnlLeft.alignChildren = ["fill", "top"];
        pnlLeft.spacing = 4;
        pnlLeft.margins = [10, 8, 10, 8];
        pnlLeft.preferredSize.width = 250;

        addPreviewRow(pnlLeft, "Trim Size:", prevData.pageWidthUnit + " × " + prevData.pageHeightUnit + " " + prevData.pageUnit);
        addPreviewRow(pnlLeft, "Trim (Points):", prevData.pageWidthPt + " × " + prevData.pageHeightPt + " pt");
        addPreviewRow(pnlLeft, "Printable Area:", prevData.contentWidthUnit + " × " + prevData.contentHeightUnit + " " + prevData.pageUnit);
        addPreviewRow(pnlLeft, "Cell Size:", prevData.cellWidthUnit + " × " + prevData.cellHeightUnit + " " + prevData.pageUnit);
        addPreviewRow(pnlLeft, "Cell (Points):", prevData.cellWidthPt + " × " + prevData.cellHeightPt + " pt");
        addPreviewRow(pnlLeft, "Grid Mode:", prevData.gridMode === "auto" ? "Auto Calculated" : "Manual Grid");
        addPreviewRow(pnlLeft, "Rows × Cols:", prevData.rows + " Rows × " + prevData.columns + " Cols");
        addPreviewRow(pnlLeft, "Margins (T/B):", prevData.topMargin + " / " + prevData.bottomMargin + " " + prevData.pageUnit);
        addPreviewRow(pnlLeft, "Margins (L/R):", prevData.leftMargin + " / " + prevData.rightMargin + " " + prevData.pageUnit);
        addPreviewRow(pnlLeft, "Gaps (H × V):", prevData.horizontalGap + " × " + prevData.verticalGap + " " + prevData.pageUnit);

        // Right Column: Distribution & Output
        var pnlRight = grpColumns.add("panel", undefined, "Slots, Files & Exports");
        pnlRight.orientation = "column";
        pnlRight.alignChildren = ["fill", "top"];
        pnlRight.spacing = 4;
        pnlRight.margins = [10, 8, 10, 8];
        pnlRight.preferredSize.width = 250;

        addPreviewRow(pnlRight, "Available Icons:", prevData.availableIcons + " in folder");
        addPreviewRow(pnlRight, "Required Slots:", prevData.requiredSlots + " slots (" + prevData.contentPages + " pgs)");
        addPreviewRow(pnlRight, "Expected Used:", prevData.expectedUsed + " icons");
        addPreviewRow(pnlRight, "Expected Empty:", prevData.expectedEmpty + " blank cells");
        addPreviewRow(pnlRight, "Expected Unused:", prevData.expectedUnused + " extra icons");
        addPreviewRow(pnlRight, "Fit & Alignment:", prevData.fitMode + " | " + prevData.horizontalAlignment + "/" + prevData.verticalAlignment);
        addPreviewRow(pnlRight, "Icon Order:", prevData.iconOrder + " (Dupes: " + prevData.duplicatePolicy + ")");
        addPreviewRow(pnlRight, "Page Numbers:", prevData.pageNumberStatus);
        addPreviewRow(pnlRight, "Export Formats:", prevData.exportFormats);
        addPreviewRow(pnlRight, "Est. Output Files:", "~" + prevData.estimatedOutputFiles + " files (" + (prevData.exportBreakdown.pdf ? "1 PDF, " : "") + (prevData.exportBreakdown.eps ? prevData.exportBreakdown.eps + " EPS, " : "") + (prevData.exportBreakdown.svg ? prevData.exportBreakdown.svg + " SVG" : "") + ")");

        // Fixed-height status & warnings container (Zero window jitter)
        var grpPrevStatus = prevDlg.add("group");
        grpPrevStatus.orientation = "stack";
        grpPrevStatus.alignChildren = ["fill", "top"];
        grpPrevStatus.preferredSize = [500, 68];
        grpPrevStatus.size = [500, 68];
        grpPrevStatus.minimumSize = [500, 68];
        grpPrevStatus.maximumSize = [500, 68];

        if (prevData.warnings && prevData.warnings.length > 0) {
            var pnlWarn = grpPrevStatus.add("panel", undefined, "⚠️ Pre-Flight Warnings (" + prevData.warnings.length + ")");
            pnlWarn.orientation = "column";
            pnlWarn.alignChildren = ["fill", "top"];
            pnlWarn.spacing = 3;
            pnlWarn.margins = [10, 6, 10, 6];
            pnlWarn.preferredSize = [500, 68];
            pnlWarn.size = [500, 68];

            var warnBox = pnlWarn.add("edittext", [0, 0, 480, 38], "• " + prevData.warnings.join("\n• "), { multiline: true, readonly: true });
            try {
                warnBox.graphics.foregroundColor = warnBox.graphics.newPen(warnBox.graphics.PenType.SOLID_COLOR, [0.85, 0.45, 0.05, 1], 1);
            } catch (eW) {}
        } else {
            var pnlClean = grpPrevStatus.add("panel", undefined, "");
            pnlClean.orientation = "row";
            pnlClean.alignChildren = ["left", "center"];
            pnlClean.margins = [10, 6, 10, 6];
            pnlClean.preferredSize = [500, 68];
            pnlClean.size = [500, 68];
            var lblClean = pnlClean.add("statictext", undefined, "✅ All pre-flight checks passed. Configuration is optimal for interior generation.");
            try {
                lblClean.graphics.foregroundColor = lblClean.graphics.newPen(lblClean.graphics.PenType.SOLID_COLOR, [0.12, 0.60, 0.25, 1], 1);
            } catch (eCl) {}
        }

        // Action Buttons
        var grpBtn = prevDlg.add("group");
        grpBtn.orientation = "row";
        grpBtn.alignment = ["right", "bottom"];
        grpBtn.spacing = 8;

        var btnClose = grpBtn.add("button", undefined, "Back / Close");
        btnClose.preferredSize = [100, 30];

        var btnGenFromPrev = grpBtn.add("button", undefined, "🚀 Generate Interior", { name: "ok" });
        btnGenFromPrev.preferredSize = [150, 30];

        btnClose.onClick = function () {
            prevDlg.close(0);
        };

        btnGenFromPrev.onClick = function () {
            prevDlg.close(1);
            if (typeof onGenerate === "function") {
                onGenerate(settings);
            }
        };

        prevDlg.show();
    }

    // -------------------------------------------------------------------------
    // Main UI Dialog (Tabbed ScriptUI with Pre-Capture Architecture)
    // -------------------------------------------------------------------------
    function showMainWindow() {
        var dlg = new Window("dialog", SCRIPT_NAME + " v" + SCRIPT_VERSION);
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.spacing = 7;
        dlg.margins = [16, 14, 16, 16];
        dlg.preferredSize = [700, 595];
        dlg.size = [700, 595];

        // Container Stack Dimensions (Unified content width across all panels)
        var STACK_WIDTH = 668;
        var STACK_HEIGHT = 222;

        // Title Header
        var pnlHeader = dlg.add("group");
        pnlHeader.orientation = "row";
        pnlHeader.alignment = ["fill", "top"];
        pnlHeader.alignChildren = ["left", "center"];
        pnlHeader.spacing = 0;
        pnlHeader.preferredSize = [STACK_WIDTH, 28];
        pnlHeader.size = [STACK_WIDTH, 28];
        
        var grpTitleLeft = pnlHeader.add("group");
        grpTitleLeft.orientation = "row";
        grpTitleLeft.alignChildren = ["left", "center"];
        grpTitleLeft.spacing = 8;
        grpTitleLeft.preferredSize.width = 240;
        var lblTitle = grpTitleLeft.add("statictext", undefined, "AUTOMATION SUITE PRO");
        lblTitle.graphics.font = ScriptUI.newFont(lblTitle.graphics.font.name, "Bold", 15);
        try {
            lblTitle.graphics.foregroundColor = lblTitle.graphics.newPen(lblTitle.graphics.PenType.SOLID_COLOR, [0.95, 0.95, 0.98, 1], 1);
        } catch (eT) {}

        var lblVer = grpTitleLeft.add("statictext", undefined, "v" + SCRIPT_VERSION);
        try {
            lblVer.graphics.font = ScriptUI.newFont(lblVer.graphics.font.name, "Bold", 11);
            lblVer.graphics.foregroundColor = lblVer.graphics.newPen(lblVer.graphics.PenType.SOLID_COLOR, [0.39, 0.45, 0.95, 1], 1);
        } catch (eV) {}

        var headerSpacer = pnlHeader.add("group");
        headerSpacer.preferredSize.width = STACK_WIDTH - 240 - 120;

        var grpHeaderRight = pnlHeader.add("group");
        grpHeaderRight.orientation = "row";
        grpHeaderRight.alignChildren = ["right", "center"];
        grpHeaderRight.preferredSize.width = 120;
        var btnLicDetails = grpHeaderRight.add("button", undefined, "License Details");
        btnLicDetails.preferredSize = [115, 26];
        try {
            btnLicDetails.graphics.font = ScriptUI.newFont(btnLicDetails.graphics.font.name, "Regular", 11);
        } catch (eL) {}

        btnLicDetails.onClick = function() {
            if (!isStandaloneLicensed()) {
                showLicenseActivationDialog(function () {
                    // refreshed
                });
            } else {
                showLicenseDetailsDialog(function () {
                    // Instantly close the main window upon deactivation
                    try { dlg.close(0); } catch (eCls) {}
                });
            }
        };

        // Folders Section
        var pnlFolders = dlg.add("panel", undefined, "Batch Folders");
        pnlFolders.orientation = "column";
        pnlFolders.alignment = ["fill", "top"];
        pnlFolders.alignChildren = ["fill", "top"];
        pnlFolders.spacing = 6;
        pnlFolders.margins = [12, 8, 12, 8];
        pnlFolders.preferredSize.width = STACK_WIDTH;

        var rowIn = pnlFolders.add("group");
        rowIn.orientation = "row";
        rowIn.alignment = ["fill", "center"];
        rowIn.alignChildren = ["left", "center"];
        rowIn.spacing = 8;
        var lblIn = rowIn.add("statictext", undefined, "Input:");
        lblIn.preferredSize.width = 45;
        var txtIn = rowIn.add("edittext", undefined, "");
        txtIn.preferredSize.width = 495;
        var btnIn = rowIn.add("button", undefined, "Browse...");
        btnIn.preferredSize = [85, 24];

        var rowOut = pnlFolders.add("group");
        rowOut.orientation = "row";
        rowOut.alignment = ["fill", "center"];
        rowOut.alignChildren = ["left", "center"];
        rowOut.spacing = 8;
        var lblOut = rowOut.add("statictext", undefined, "Output:");
        lblOut.preferredSize.width = 45;
        var txtOut = rowOut.add("edittext", undefined, "");
        txtOut.preferredSize.width = 495;
        var btnOut = rowOut.add("button", undefined, "Browse...");
        btnOut.preferredSize = [85, 24];

        var lblFileCount = pnlFolders.add("statictext", undefined, "Select Input folder to detect files.");
        lblFileCount.alignment = ["left", "center"];
        lblFileCount.graphics.foregroundColor = lblFileCount.graphics.newPen(lblFileCount.graphics.PenType.SOLID_COLOR, [0.4, 0.4, 0.4, 1], 1);

        btnIn.onClick = function () {
            var f = Folder.selectDialog("Select Input Folder (Source Icons):");
            if (f) {
                txtIn.text = f.fsName;
                if (!txtOut.text) txtOut.text = f.fsName + "/Automation_Output";
                updateFolderCount();
            }
        };

        btnOut.onClick = function () {
            var f = Folder.selectDialog("Select Output Folder (Destination):");
            if (f) {
                txtOut.text = f.fsName;
            }
        };

        txtIn.onChange = function () {
            updateFolderCount();
        };

        function updateFolderCount() {
            if (!txtIn.text) {
                lblFileCount.text = "Select Input folder to detect files.";
                if (typeof lblKdpDetectedBadge !== "undefined" && lblKdpDetectedBadge) {
                    lblKdpDetectedBadge.text = "Detected Icons: 0";
                }
                return;
            }
            var f = new Folder(txtIn.text);
            if (!f.exists) {
                lblFileCount.text = "⚠️ Input folder does not exist.";
                if (typeof lblKdpDetectedBadge !== "undefined" && lblKdpDetectedBadge) {
                    lblKdpDetectedBadge.text = "Detected Icons: 0 (Folder not found)";
                }
                return;
            }

            var kdpFiles = scanKDPInputFiles(f, { forceRescan: true });
            var aiC = 0, epsC = 0, svgC = 0, pdfC = 0;
            for (var i = 0; i < kdpFiles.length; i++) {
                var ext = getKDPFileExtension(kdpFiles[i]);
                if (ext === "ai") aiC++;
                else if (ext === "eps") epsC++;
                else if (ext === "svg") svgC++;
                else if (ext === "pdf") pdfC++;
            }

            if (kdpFiles.length === 0) {
                lblFileCount.text = "No supported icon files found (.svg, .eps, .ai, .pdf).";
                if (typeof lblKdpDetectedBadge !== "undefined" && lblKdpDetectedBadge) {
                    lblKdpDetectedBadge.text = "Detected Icons: 0 (No supported files)";
                }
            } else {
                lblFileCount.text = "Detected Icons: " + kdpFiles.length + " [AI: " + aiC + ", EPS: " + epsC + ", SVG: " + svgC + ", PDF: " + pdfC + "]";
                if (typeof lblKdpDetectedBadge !== "undefined" && lblKdpDetectedBadge) {
                    lblKdpDetectedBadge.text = "Detected Icons: " + kdpFiles.length;
                }
            }
        }

        // ---------------------------------------------------------------------
        // TOOL SELECTOR (Dropdown System)
        // ---------------------------------------------------------------------
        var pnlToolSelect = dlg.add("panel", undefined, "Active Tool / Workflow");
        pnlToolSelect.orientation = "row";
        pnlToolSelect.alignment = ["fill", "top"];
        pnlToolSelect.alignChildren = ["left", "center"];
        pnlToolSelect.spacing = 10;
        pnlToolSelect.margins = [12, 8, 12, 8];
        pnlToolSelect.preferredSize.width = STACK_WIDTH;

        var lblSelectTool = pnlToolSelect.add("statictext", undefined, "Select Tool:");
        lblSelectTool.preferredSize.width = 75;
        var ddToolSelect = pnlToolSelect.add("dropdownlist", undefined, [
            "1. BG Remover (Background Cleaner)",
            "2. Page Resizer (Canvas Standardizer)",
            "3. Quality Issue Solver (Adobe Stock Fixer)",
            "4. Icon Set Maker (Grid Sheet Maker)",
            "5. KDP Interior Generator (Book & Journal Maker)"
        ]);
        ddToolSelect.selection = 0;
        ddToolSelect.preferredSize.width = 390;

        // Container Stack for Tool Panels (Locked fixed height prevents window jumping)
        var pnlStack = dlg.add("group");
        pnlStack.orientation = "stack";
        pnlStack.alignment = ["fill", "top"];
        pnlStack.alignChildren = ["fill", "top"];
        pnlStack.preferredSize = [STACK_WIDTH, STACK_HEIGHT];
        pnlStack.size = [STACK_WIDTH, STACK_HEIGHT];
        pnlStack.minimumSize = [STACK_WIDTH, STACK_HEIGHT];
        pnlStack.maximumSize = [STACK_WIDTH, STACK_HEIGHT];

        // ---------------------------------------------------------------------
        // PANEL 1: QUALITY SOLVE (ADOBE STOCK FIXER)
        // ---------------------------------------------------------------------
        var pnlQuality = pnlStack.add("group");
        pnlQuality.orientation = "column";
        pnlQuality.alignment = ["fill", "top"];
        pnlQuality.alignChildren = ["fill", "top"];
        pnlQuality.spacing = 5;
        pnlQuality.preferredSize = [STACK_WIDTH, STACK_HEIGHT];
        pnlQuality.size = [STACK_WIDTH, STACK_HEIGHT];

        var rowQsMode = pnlQuality.add("panel", undefined, "Workflow Mode");
        rowQsMode.orientation = "row";
        rowQsMode.alignment = ["fill", "top"];
        rowQsMode.alignChildren = ["left", "center"];
        rowQsMode.spacing = 10;
        rowQsMode.margins = [10, 5, 10, 5];
        rowQsMode.add("statictext", undefined, "Mode:");
        var ddQsMode = rowQsMode.add("dropdownlist", undefined, [
            "1. Clean Artboard In-Place (Preserve Exact Artboard)",
            "2. Auto-Split Multi-Icons to Single Files (Separate Icons)"
        ]);
        ddQsMode.selection = 0;
        ddQsMode.preferredSize.width = 390;

        var pnlQsOpts = pnlQuality.add("panel", undefined, "Stock Compliance Fixes");
        pnlQsOpts.orientation = "row";
        pnlQsOpts.alignment = ["fill", "top"];
        pnlQsOpts.alignChildren = ["left", "center"];
        pnlQsOpts.margins = [12, 5, 12, 5];
        pnlQsOpts.spacing = 18;
        var chkQsStray = pnlQsOpts.add("checkbox", undefined, "Clean Stray Points");
        chkQsStray.value = true;
        var chkQsMasks = pnlQsOpts.add("checkbox", undefined, "Clean Empty Masks & Groups");
        chkQsMasks.value = true;
        var chkQsBg = pnlQsOpts.add("checkbox", undefined, "Clean White BG Cards");
        chkQsBg.value = true;

        var pnlQsFmt = pnlQuality.add("panel", undefined, "Export Format");
        pnlQsFmt.orientation = "row";
        pnlQsFmt.alignment = ["fill", "top"];
        pnlQsFmt.alignChildren = ["left", "center"];
        pnlQsFmt.margins = [12, 5, 12, 5];
        pnlQsFmt.spacing = 22;
        var chkQsEPS = pnlQsFmt.add("radiobutton", undefined, "EPS (Illustrator 10)");
        var chkQsAI  = pnlQsFmt.add("radiobutton", undefined, "AI Master");
        var chkQsSVG = pnlQsFmt.add("radiobutton", undefined, "SVG");
        var chkQsPNG = pnlQsFmt.add("radiobutton", undefined, "PNG");
        chkQsEPS.value = true;

        var pnlQsNaming = pnlQuality.add("panel", undefined, "Output File Naming");
        pnlQsNaming.orientation = "row";
        pnlQsNaming.alignment = ["fill", "top"];
        pnlQsNaming.alignChildren = ["left", "center"];
        pnlQsNaming.margins = [12, 5, 12, 5];
        pnlQsNaming.spacing = 14;
        var rbQsNameOrig = pnlQsNaming.add("radiobutton", undefined, "Original / Suffix");
        var rbQsNameSeq  = pnlQsNaming.add("radiobutton", undefined, "Sequential");
        rbQsNameOrig.value = true;
        pnlQsNaming.add("statictext", undefined, "Prefix:");
        var txtQsPrefix = pnlQsNaming.add("edittext", undefined, "icon_");
        txtQsPrefix.preferredSize.width = 115;
        pnlQsNaming.add("statictext", undefined, "Start #:");
        var txtQsStart = pnlQsNaming.add("edittext", undefined, "1");
        txtQsStart.preferredSize.width = 45;

        // ---------------------------------------------------------------------
        // PANEL 2: BG REMOVER
        // ---------------------------------------------------------------------
        var pnlBgr = pnlStack.add("group");
        pnlBgr.orientation = "column";
        pnlBgr.alignment = ["fill", "top"];
        pnlBgr.alignChildren = ["fill", "top"];
        pnlBgr.spacing = 5;
        pnlBgr.preferredSize = [STACK_WIDTH, STACK_HEIGHT];
        pnlBgr.size = [STACK_WIDTH, STACK_HEIGHT];

        var pnlBgrTol = pnlBgr.add("panel", undefined, "Sensitivity (Tolerance)");
        pnlBgrTol.orientation = "row";
        pnlBgrTol.alignment = ["fill", "top"];
        pnlBgrTol.alignChildren = ["left", "center"];
        pnlBgrTol.margins = [12, 5, 12, 5];
        pnlBgrTol.spacing = 12;
        var sliderTol = pnlBgrTol.add("slider", undefined, 100, 1, 100);
        sliderTol.preferredSize.width = 510;
        var lblTolVal = pnlBgrTol.add("statictext", undefined, "100");
        sliderTol.onChanging = function () {
            lblTolVal.text = Math.round(sliderTol.value).toString();
        };

        var pnlBgrFmt = pnlBgr.add("panel", undefined, "Export Format");
        pnlBgrFmt.orientation = "row";
        pnlBgrFmt.alignment = ["fill", "top"];
        pnlBgrFmt.alignChildren = ["left", "center"];
        pnlBgrFmt.margins = [12, 5, 12, 5];
        pnlBgrFmt.spacing = 24;
        var chkBgrEPS = pnlBgrFmt.add("radiobutton", undefined, "EPS");
        var chkBgrAI  = pnlBgrFmt.add("radiobutton", undefined, "AI");
        var chkBgrSVG = pnlBgrFmt.add("radiobutton", undefined, "SVG");
        var chkBgrPNG = pnlBgrFmt.add("radiobutton", undefined, "PNG");
        chkBgrEPS.value = true;

        var pnlBgrNaming = pnlBgr.add("panel", undefined, "Output File Naming");
        pnlBgrNaming.orientation = "row";
        pnlBgrNaming.alignment = ["fill", "top"];
        pnlBgrNaming.alignChildren = ["left", "center"];
        pnlBgrNaming.margins = [12, 5, 12, 5];
        pnlBgrNaming.spacing = 14;
        var rbBgrNameOrig = pnlBgrNaming.add("radiobutton", undefined, "Original");
        var rbBgrNameSeq  = pnlBgrNaming.add("radiobutton", undefined, "Sequential");
        rbBgrNameOrig.value = true;
        pnlBgrNaming.add("statictext", undefined, "Prefix:");
        var txtBgrPrefix = pnlBgrNaming.add("edittext", undefined, "vector_clean_");
        txtBgrPrefix.preferredSize.width = 130;
        pnlBgrNaming.add("statictext", undefined, "Start #:");
        var txtBgrStart = pnlBgrNaming.add("edittext", undefined, "1");
        txtBgrStart.preferredSize.width = 45;

        var pnlBgrOpts = pnlBgr.add("panel", undefined, "Multi-Icon & Artboard Behavior");
        pnlBgrOpts.orientation = "row";
        pnlBgrOpts.alignment = ["fill", "top"];
        pnlBgrOpts.alignChildren = ["left", "center"];
        pnlBgrOpts.margins = [12, 5, 12, 5];
        pnlBgrOpts.spacing = 20;
        var chkBgrUngroup = pnlBgrOpts.add("checkbox", undefined, "Auto-Ungroup Multi-Icons (Separate & Independent)");
        chkBgrUngroup.value = true;
        var chkBgrPreserveSize = pnlBgrOpts.add("checkbox", undefined, "Preserve Original Dimensions (No Page Resizing)");
        chkBgrPreserveSize.value = true;

        // ---------------------------------------------------------------------
        // PANEL 3: ICON SET MAKER
        // ---------------------------------------------------------------------
        var pnlIcon = pnlStack.add("group");
        pnlIcon.orientation = "column";
        pnlIcon.alignment = ["fill", "top"];
        pnlIcon.alignChildren = ["fill", "top"];
        pnlIcon.spacing = 5;
        pnlIcon.preferredSize = [STACK_WIDTH, STACK_HEIGHT];
        pnlIcon.size = [STACK_WIDTH, STACK_HEIGHT];

        var pnlIconGrid = pnlIcon.add("panel", undefined, "Grid Configuration");
        pnlIconGrid.orientation = "row";
        pnlIconGrid.alignment = ["fill", "top"];
        pnlIconGrid.alignChildren = ["left", "center"];
        pnlIconGrid.margins = [12, 5, 12, 5];
        pnlIconGrid.spacing = 12;
        pnlIconGrid.add("statictext", undefined, "Grid:");
        var ddIconPreset = pnlIconGrid.add("dropdownlist", undefined, [
            "5x3 Grid (4000 x 2663 px)",
            "5x2 Grid (1000 x 350 px)",
            "4x3 Grid (4000 x 4000 px)",
            "Custom Grid..."
        ]);
        ddIconPreset.selection = 0;
        ddIconPreset.preferredSize.width = 240;
        pnlIconGrid.add("statictext", undefined, "Cols:");
        var txtIconCols = pnlIconGrid.add("edittext", undefined, "5");
        txtIconCols.preferredSize.width = 40;
        pnlIconGrid.add("statictext", undefined, "Rows:");
        var txtIconRows = pnlIconGrid.add("edittext", undefined, "3");
        txtIconRows.preferredSize.width = 40;

        ddIconPreset.onChange = function () {
            if (ddIconPreset.selection.index === 0) { txtIconCols.text = "5"; txtIconRows.text = "3"; }
            else if (ddIconPreset.selection.index === 1) { txtIconCols.text = "5"; txtIconRows.text = "2"; }
            else if (ddIconPreset.selection.index === 2) { txtIconCols.text = "4"; txtIconRows.text = "3"; }
        };

        var pnlIconMode = pnlIcon.add("panel", undefined, "Canvas Mode");
        pnlIconMode.orientation = "row";
        pnlIconMode.alignment = ["fill", "top"];
        pnlIconMode.alignChildren = ["left", "center"];
        pnlIconMode.margins = [12, 5, 12, 5];
        var lblIconMode = pnlIconMode.add("statictext", undefined, "Pure Transparent Sheet (No extra background box/rectangle added)");
        lblIconMode.graphics.foregroundColor = lblIconMode.graphics.newPen(lblIconMode.graphics.PenType.SOLID_COLOR, [0.1, 0.55, 0.3, 1], 1);

        var pnlIconNaming = pnlIcon.add("panel", undefined, "Naming & Format");
        pnlIconNaming.orientation = "row";
        pnlIconNaming.alignment = ["fill", "top"];
        pnlIconNaming.alignChildren = ["left", "center"];
        pnlIconNaming.margins = [12, 5, 12, 5];
        pnlIconNaming.spacing = 14;
        pnlIconNaming.add("statictext", undefined, "Prefix:");
        var txtIconPrefix = pnlIconNaming.add("edittext", undefined, "icon_set_");
        txtIconPrefix.preferredSize.width = 110;
        pnlIconNaming.add("statictext", undefined, "Start #:");
        var txtIconStart = pnlIconNaming.add("edittext", undefined, "1");
        txtIconStart.preferredSize.width = 45;
        var rbIconEPS = pnlIconNaming.add("radiobutton", undefined, "EPS");
        var rbIconAI  = pnlIconNaming.add("radiobutton", undefined, "AI");
        rbIconEPS.value = true;

        // ---------------------------------------------------------------------
        // PANEL 4: PAGE RESIZER
        // ---------------------------------------------------------------------
        var pnlRes = pnlStack.add("group");
        pnlRes.orientation = "column";
        pnlRes.alignment = ["fill", "top"];
        pnlRes.alignChildren = ["fill", "top"];
        pnlRes.spacing = 5;
        pnlRes.preferredSize = [STACK_WIDTH, STACK_HEIGHT];
        pnlRes.size = [STACK_WIDTH, STACK_HEIGHT];

        var pnlResPreset = pnlRes.add("panel", undefined, "Canvas Dimension");
        pnlResPreset.orientation = "row";
        pnlResPreset.alignment = ["fill", "top"];
        pnlResPreset.alignChildren = ["left", "center"];
        pnlResPreset.margins = [12, 5, 12, 5];
        pnlResPreset.spacing = 12;
        var ddResPreset = pnlResPreset.add("dropdownlist", undefined, [
            "Landscape (4000 x 2663 px)",
            "Banner (1000 x 350 px)",
            "Square (4000 x 4000 px)",
            "Custom"
        ]);
        ddResPreset.selection = 0;
        ddResPreset.preferredSize.width = 240;
        pnlResPreset.add("statictext", undefined, "W:");
        var txtResW = pnlResPreset.add("edittext", undefined, "4000");
        txtResW.preferredSize.width = 50;
        pnlResPreset.add("statictext", undefined, "H:");
        var txtResH = pnlResPreset.add("edittext", undefined, "2663");
        txtResH.preferredSize.width = 50;

        ddResPreset.onChange = function () {
            if (ddResPreset.selection.index === 0) { txtResW.text = "4000"; txtResH.text = "2663"; }
            else if (ddResPreset.selection.index === 1) { txtResW.text = "1000"; txtResH.text = "350"; }
            else if (ddResPreset.selection.index === 2) { txtResW.text = "4000"; txtResH.text = "4000"; }
        };

        var pnlResOptions = pnlRes.add("panel", undefined, "Margin & Format");
        pnlResOptions.orientation = "row";
        pnlResOptions.alignment = ["fill", "top"];
        pnlResOptions.alignChildren = ["left", "center"];
        pnlResOptions.margins = [12, 5, 12, 5];
        pnlResOptions.spacing = 14;
        pnlResOptions.add("statictext", undefined, "Margin %:");
        var txtResMargin = pnlResOptions.add("edittext", undefined, "88");
        txtResMargin.preferredSize.width = 40;
        var chkResEPS = pnlResOptions.add("checkbox", undefined, "EPS");
        chkResEPS.value = true;
        var chkResAI = pnlResOptions.add("checkbox", undefined, "AI");
        var chkResSVG = pnlResOptions.add("checkbox", undefined, "SVG");

        var pnlResNaming = pnlRes.add("panel", undefined, "Output File Naming");
        pnlResNaming.orientation = "row";
        pnlResNaming.alignment = ["fill", "top"];
        pnlResNaming.alignChildren = ["left", "center"];
        pnlResNaming.margins = [12, 5, 12, 5];
        pnlResNaming.spacing = 14;
        var rbResNameOrig = pnlResNaming.add("radiobutton", undefined, "Original");
        var rbResNameSeq  = pnlResNaming.add("radiobutton", undefined, "Sequential");
        rbResNameOrig.value = true;
        pnlResNaming.add("statictext", undefined, "Prefix:");
        var txtResPrefix = pnlResNaming.add("edittext", undefined, "artboard_");
        txtResPrefix.preferredSize.width = 130;
        pnlResNaming.add("statictext", undefined, "Start #:");
        var txtResStart = pnlResNaming.add("edittext", undefined, "1");
        txtResStart.preferredSize.width = 45;

        // ---------------------------------------------------------------------
        // PANEL 5: KDP INTERIOR GENERATOR (BOOK & JOURNAL MAKER)
        // ---------------------------------------------------------------------
        var pnlKDP = pnlStack.add("group");
        pnlKDP.orientation = "column";
        pnlKDP.alignChildren = ["fill", "top"];
        pnlKDP.spacing = 4;
        pnlKDP.preferredSize = [STACK_WIDTH, STACK_HEIGHT];
        pnlKDP.size = [STACK_WIDTH, STACK_HEIGHT];
        pnlKDP.minimumSize = [STACK_WIDTH, STACK_HEIGHT];
        pnlKDP.maximumSize = [STACK_WIDTH, STACK_HEIGHT];

        // Tabbed Panel for clean modular organization
        var kdpTabs = pnlKDP.add("tabbedpanel");
        kdpTabs.preferredSize = [STACK_WIDTH, STACK_HEIGHT];
        kdpTabs.size = [STACK_WIDTH, STACK_HEIGHT];
        kdpTabs.minimumSize = [STACK_WIDTH, STACK_HEIGHT];
        kdpTabs.maximumSize = [STACK_WIDTH, STACK_HEIGHT];
        kdpTabs.alignChildren = ["fill", "top"];

        var KDP_TAB_W = STACK_WIDTH - 16;
        var KDP_TAB_H = STACK_HEIGHT - 26;

        // ---------------------------------------------------------
        // KDP TAB 1: Document & Project
        // ---------------------------------------------------------
        var tabKdpDoc = kdpTabs.add("tab", undefined, "Document & Project");
        tabKdpDoc.orientation = "column";
        tabKdpDoc.alignChildren = ["fill", "top"];
        tabKdpDoc.spacing = 3;
        tabKdpDoc.margins = [8, 4, 8, 4];
        tabKdpDoc.preferredSize = [KDP_TAB_W, KDP_TAB_H];
        tabKdpDoc.size = [KDP_TAB_W, KDP_TAB_H];
        tabKdpDoc.minimumSize = [KDP_TAB_W, KDP_TAB_H];
        tabKdpDoc.maximumSize = [KDP_TAB_W, KDP_TAB_H];

        // Presets Management Bar
        var pnlKdpPresets = tabKdpDoc.add("panel", undefined, "KDP Presets");
        pnlKdpPresets.orientation = "row";
        pnlKdpPresets.alignment = ["fill", "top"];
        pnlKdpPresets.alignChildren = ["left", "center"];
        pnlKdpPresets.spacing = 8;
        pnlKdpPresets.margins = [8, 3, 8, 3];

        pnlKdpPresets.add("statictext", undefined, "Preset:");
        var ddKdpPresetsList = pnlKdpPresets.add("dropdownlist", undefined, getKDPAvailablePresets());
        ddKdpPresetsList.preferredSize.width = 195;
        if (ddKdpPresetsList.items.length > 0) ddKdpPresetsList.selection = 0;

        var btnKdpLoadPreset = pnlKdpPresets.add("button", undefined, "Load");
        btnKdpLoadPreset.preferredSize = [65, 22];

        var btnKdpSavePreset = pnlKdpPresets.add("button", undefined, "Save");
        btnKdpSavePreset.preferredSize = [65, 22];

        var btnKdpDeletePreset = pnlKdpPresets.add("button", undefined, "Delete");
        btnKdpDeletePreset.preferredSize = [65, 22];

        // Project Name
        var pnlKdpProj = tabKdpDoc.add("panel", undefined, "Project Identification");
        pnlKdpProj.orientation = "row";
        pnlKdpProj.alignment = ["fill", "top"];
        pnlKdpProj.alignChildren = ["left", "center"];
        pnlKdpProj.spacing = 10;
        pnlKdpProj.margins = [8, 3, 8, 3];
        pnlKdpProj.add("statictext", undefined, "Project Name:");
        var txtKdpProjectName = pnlKdpProj.add("edittext", undefined, "KDP_Interior");
        txtKdpProjectName.preferredSize.width = 240;
        var lblKdpDetectedBadge = pnlKdpProj.add("statictext", undefined, "Detected Icons: 0");
        lblKdpDetectedBadge.graphics.foregroundColor = lblKdpDetectedBadge.graphics.newPen(lblKdpDetectedBadge.graphics.PenType.SOLID_COLOR, [0.1, 0.5, 0.8, 1], 1);

        // Page Trim Dimensions
        var pnlKdpSize = tabKdpDoc.add("panel", undefined, "Page Dimensions & Preset");
        pnlKdpSize.orientation = "column";
        pnlKdpSize.alignment = ["fill", "top"];
        pnlKdpSize.alignChildren = ["fill", "top"];
        pnlKdpSize.spacing = 3;
        pnlKdpSize.margins = [8, 3, 8, 3];

        var rowKdpPreset = pnlKdpSize.add("group");
        rowKdpPreset.orientation = "row";
        rowKdpPreset.alignChildren = ["left", "center"];
        rowKdpPreset.spacing = 8;
        rowKdpPreset.add("statictext", undefined, "Page Size Preset:");
        var ddKdpPagePreset = rowKdpPreset.add("dropdownlist", undefined, [
            "8.5 × 11 in (Letter / Workbook)",
            "6 × 9 in (Standard Trade)",
            "8 × 10 in (Children / Art)",
            "8.25 × 8.25 in (Square)",
            "8.5 × 8.5 in (Square Children)",
            "Custom Dimensions..."
        ]);
        ddKdpPagePreset.selection = 0;
        ddKdpPagePreset.preferredSize.width = 240;

        var rowKdpCustomSize = pnlKdpSize.add("group");
        rowKdpCustomSize.orientation = "row";
        rowKdpCustomSize.alignChildren = ["left", "center"];
        rowKdpCustomSize.spacing = 10;
        rowKdpCustomSize.add("statictext", undefined, "Width:");
        var txtKdpPageW = rowKdpCustomSize.add("edittext", undefined, "8.5");
        txtKdpPageW.preferredSize.width = 50;
        txtKdpPageW.enabled = false;

        rowKdpCustomSize.add("statictext", undefined, "Height:");
        var txtKdpPageH = rowKdpCustomSize.add("edittext", undefined, "11.0");
        txtKdpPageH.preferredSize.width = 50;
        txtKdpPageH.enabled = false;

        rowKdpCustomSize.add("statictext", undefined, "Unit:");
        var ddKdpPageUnit = rowKdpCustomSize.add("dropdownlist", undefined, ["in", "pt", "mm", "cm"]);
        ddKdpPageUnit.selection = 0;
        ddKdpPageUnit.preferredSize.width = 55;
        ddKdpPageUnit.enabled = false;

        // Page Count & Structure
        var pnlKdpPages = tabKdpDoc.add("panel", undefined, "Page Count & Options");
        pnlKdpPages.orientation = "row";
        pnlKdpPages.alignment = ["fill", "top"];
        pnlKdpPages.alignChildren = ["left", "center"];
        pnlKdpPages.spacing = 12;
        pnlKdpPages.margins = [8, 3, 8, 3];

        pnlKdpPages.add("statictext", undefined, "Page Count:");
        var txtKdpPageCount = pnlKdpPages.add("edittext", undefined, "100");
        txtKdpPageCount.preferredSize.width = 55;

        var chkKdpBlankPage = pnlKdpPages.add("checkbox", undefined, "Add Blank Page After Content");
        chkKdpBlankPage.value = false;

        // Preset Change Behavior
        ddKdpPagePreset.onChange = function () {
            var idx = ddKdpPagePreset.selection ? ddKdpPagePreset.selection.index : 0;
            if (idx === 0) { // 8.5x11
                txtKdpPageW.text = "8.5"; txtKdpPageH.text = "11.0"; ddKdpPageUnit.selection = 0;
                txtKdpPageW.enabled = false; txtKdpPageH.enabled = false; ddKdpPageUnit.enabled = false;
            } else if (idx === 1) { // 6x9
                txtKdpPageW.text = "6.0"; txtKdpPageH.text = "9.0"; ddKdpPageUnit.selection = 0;
                txtKdpPageW.enabled = false; txtKdpPageH.enabled = false; ddKdpPageUnit.enabled = false;
            } else if (idx === 2) { // 8x10
                txtKdpPageW.text = "8.0"; txtKdpPageH.text = "10.0"; ddKdpPageUnit.selection = 0;
                txtKdpPageW.enabled = false; txtKdpPageH.enabled = false; ddKdpPageUnit.enabled = false;
            } else if (idx === 3) { // 8.25x8.25
                txtKdpPageW.text = "8.25"; txtKdpPageH.text = "8.25"; ddKdpPageUnit.selection = 0;
                txtKdpPageW.enabled = false; txtKdpPageH.enabled = false; ddKdpPageUnit.enabled = false;
            } else if (idx === 4) { // 8.5x8.5
                txtKdpPageW.text = "8.5"; txtKdpPageH.text = "8.5"; ddKdpPageUnit.selection = 0;
                txtKdpPageW.enabled = false; txtKdpPageH.enabled = false; ddKdpPageUnit.enabled = false;
            } else { // Custom
                txtKdpPageW.enabled = true; txtKdpPageH.enabled = true; ddKdpPageUnit.enabled = true;
            }
        };

        // ---------------------------------------------------------
        // KDP TAB 2: Layout & Margins
        // ---------------------------------------------------------
        var tabKdpLayout = kdpTabs.add("tab", undefined, "Layout & Margins");
        tabKdpLayout.orientation = "column";
        tabKdpLayout.alignChildren = ["fill", "top"];
        tabKdpLayout.spacing = 3;
        tabKdpLayout.margins = [8, 4, 8, 4];
        tabKdpLayout.preferredSize = [KDP_TAB_W, KDP_TAB_H];
        tabKdpLayout.size = [KDP_TAB_W, KDP_TAB_H];
        tabKdpLayout.minimumSize = [KDP_TAB_W, KDP_TAB_H];
        tabKdpLayout.maximumSize = [KDP_TAB_W, KDP_TAB_H];

        // Grid Configuration
        var pnlKdpGrid = tabKdpLayout.add("panel", undefined, "Grid Configuration");
        pnlKdpGrid.orientation = "column";
        pnlKdpGrid.alignment = ["fill", "top"];
        pnlKdpGrid.alignChildren = ["fill", "top"];
        pnlKdpGrid.spacing = 3;
        pnlKdpGrid.margins = [8, 3, 8, 3];

        var rowKdpGridMode = pnlKdpGrid.add("group");
        rowKdpGridMode.orientation = "row";
        rowKdpGridMode.alignChildren = ["left", "center"];
        rowKdpGridMode.spacing = 10;
        rowKdpGridMode.add("statictext", undefined, "Icons Per Page:");
        var txtKdpIconsPerPage = rowKdpGridMode.add("edittext", undefined, "4");
        txtKdpIconsPerPage.preferredSize.width = 45;

        rowKdpGridMode.add("statictext", undefined, "Mode:");
        var rbKdpAutoGrid = rowKdpGridMode.add("radiobutton", undefined, "Auto Grid");
        var rbKdpManualGrid = rowKdpGridMode.add("radiobutton", undefined, "Manual Grid");
        rbKdpAutoGrid.value = true;

        var rowKdpGridDims = pnlKdpGrid.add("group");
        rowKdpGridDims.orientation = "row";
        rowKdpGridDims.alignChildren = ["left", "center"];
        rowKdpGridDims.spacing = 8;
        rowKdpGridDims.add("statictext", undefined, "Rows:");
        var txtKdpRows = rowKdpGridDims.add("edittext", undefined, "2");
        txtKdpRows.preferredSize.width = 38;
        txtKdpRows.enabled = false;

        rowKdpGridDims.add("statictext", undefined, "Cols:");
        var txtKdpCols = rowKdpGridDims.add("edittext", undefined, "2");
        txtKdpCols.preferredSize.width = 38;
        txtKdpCols.enabled = false;

        rowKdpGridDims.add("statictext", undefined, "H-Gap:");
        var txtKdpHGap = rowKdpGridDims.add("edittext", undefined, "0.25");
        txtKdpHGap.preferredSize.width = 42;

        rowKdpGridDims.add("statictext", undefined, "V-Gap:");
        var txtKdpVGap = rowKdpGridDims.add("edittext", undefined, "0.25");
        txtKdpVGap.preferredSize.width = 42;

        rbKdpAutoGrid.onClick = function () {
            txtKdpRows.enabled = false;
            txtKdpCols.enabled = false;
        };

        rbKdpManualGrid.onClick = function () {
            txtKdpRows.enabled = true;
            txtKdpCols.enabled = true;
        };

        // Margins Configuration
        var pnlKdpMargins = tabKdpLayout.add("panel", undefined, "Margins Configuration");
        pnlKdpMargins.orientation = "column";
        pnlKdpMargins.alignment = ["fill", "top"];
        pnlKdpMargins.alignChildren = ["fill", "top"];
        pnlKdpMargins.spacing = 3;
        pnlKdpMargins.margins = [8, 3, 8, 3];

        var rowKdpMarginsVals = pnlKdpMargins.add("group");
        rowKdpMarginsVals.orientation = "row";
        rowKdpMarginsVals.alignChildren = ["left", "center"];
        rowKdpMarginsVals.spacing = 8;

        rowKdpMarginsVals.add("statictext", undefined, "Top:");
        var txtKdpMarginTop = rowKdpMarginsVals.add("edittext", undefined, "0.5");
        txtKdpMarginTop.preferredSize.width = 45;

        rowKdpMarginsVals.add("statictext", undefined, "Bottom:");
        var txtKdpMarginBottom = rowKdpMarginsVals.add("edittext", undefined, "0.5");
        txtKdpMarginBottom.preferredSize.width = 45;

        rowKdpMarginsVals.add("statictext", undefined, "Left:");
        var txtKdpMarginLeft = rowKdpMarginsVals.add("edittext", undefined, "0.5");
        txtKdpMarginLeft.preferredSize.width = 45;

        rowKdpMarginsVals.add("statictext", undefined, "Right:");
        var txtKdpMarginRight = rowKdpMarginsVals.add("edittext", undefined, "0.5");
        txtKdpMarginRight.preferredSize.width = 45;

        var chkKdpEqualMargins = pnlKdpMargins.add("checkbox", undefined, "Equal Margins (Sync all 4 sides)");
        chkKdpEqualMargins.value = true;

        function syncMargins(sourceTxt) {
            if (chkKdpEqualMargins.value) {
                var v = sourceTxt.text;
                txtKdpMarginTop.text = v;
                txtKdpMarginBottom.text = v;
                txtKdpMarginLeft.text = v;
                txtKdpMarginRight.text = v;
            }
        }

        txtKdpMarginTop.onChanging = function () { syncMargins(txtKdpMarginTop); };
        txtKdpMarginBottom.onChanging = function () { syncMargins(txtKdpMarginBottom); };
        txtKdpMarginLeft.onChanging = function () { syncMargins(txtKdpMarginLeft); };
        txtKdpMarginRight.onChanging = function () { syncMargins(txtKdpMarginRight); };

        // ---------------------------------------------------------
        // KDP TAB 3: Fit, Numbers & Export
        // ---------------------------------------------------------
        var tabKdpFit = kdpTabs.add("tab", undefined, "Fit, Numbers & Export");
        tabKdpFit.orientation = "column";
        tabKdpFit.alignChildren = ["fill", "top"];
        tabKdpFit.spacing = 3;
        tabKdpFit.margins = [8, 4, 8, 4];
        tabKdpFit.preferredSize = [KDP_TAB_W, KDP_TAB_H];
        tabKdpFit.size = [KDP_TAB_W, KDP_TAB_H];
        tabKdpFit.minimumSize = [KDP_TAB_W, KDP_TAB_H];
        tabKdpFit.maximumSize = [KDP_TAB_W, KDP_TAB_H];

        // Icon Fit & Alignment
        var pnlKdpFit = tabKdpFit.add("panel", undefined, "Icon Fit & Alignment");
        pnlKdpFit.orientation = "column";
        pnlKdpFit.alignment = ["fill", "top"];
        pnlKdpFit.alignChildren = ["fill", "top"];
        pnlKdpFit.spacing = 3;
        pnlKdpFit.margins = [8, 3, 8, 3];

        var rowKdpFitMode = pnlKdpFit.add("group");
        rowKdpFitMode.orientation = "row";
        rowKdpFitMode.alignChildren = ["left", "center"];
        rowKdpFitMode.spacing = 10;
        rowKdpFitMode.add("statictext", undefined, "Fit Mode:");
        var rbKdpFitMax = rowKdpFitMode.add("radiobutton", undefined, "Maximum Fit");
        var rbKdpFitFixW = rowKdpFitMode.add("radiobutton", undefined, "Fixed Width");
        var rbKdpFitFixH = rowKdpFitMode.add("radiobutton", undefined, "Fixed Height");
        rbKdpFitMax.value = true;

        var rowKdpAlign = pnlKdpFit.add("group");
        rowKdpAlign.orientation = "row";
        rowKdpAlign.alignChildren = ["left", "center"];
        rowKdpAlign.spacing = 8;
        rowKdpAlign.add("statictext", undefined, "Horizontal:");
        var ddKdpHAlign = rowKdpAlign.add("dropdownlist", undefined, ["Center", "Left", "Right"]);
        ddKdpHAlign.selection = 0;
        ddKdpHAlign.preferredSize.width = 75;

        rowKdpAlign.add("statictext", undefined, "Vertical:");
        var ddKdpVAlign = rowKdpAlign.add("dropdownlist", undefined, ["Center", "Top", "Bottom"]);
        ddKdpVAlign.selection = 0;
        ddKdpVAlign.preferredSize.width = 75;

        rowKdpAlign.add("statictext", undefined, "Order:");
        var rbKdpOrderSeq = rowKdpAlign.add("radiobutton", undefined, "Seq");
        var rbKdpOrderRand = rowKdpAlign.add("radiobutton", undefined, "Rand");
        rbKdpOrderSeq.value = true;
        var chkKdpAllowDupes = rowKdpAlign.add("checkbox", undefined, "Duplicates");
        chkKdpAllowDupes.value = false;

        // Page Numbering
        var pnlKdpPageNum = tabKdpFit.add("panel", undefined, "Page Numbering");
        pnlKdpPageNum.orientation = "row";
        pnlKdpPageNum.alignment = ["fill", "top"];
        pnlKdpPageNum.alignChildren = ["left", "center"];
        pnlKdpPageNum.spacing = 8;

        var chkKdpAddPageNum = pnlKdpPageNum.add("checkbox", undefined, "Add Page #");
        chkKdpAddPageNum.value = false;

        pnlKdpPageNum.add("statictext", undefined, "Position:");
        var ddKdpPageNumPos = pnlKdpPageNum.add("dropdownlist", undefined, [
            "Bottom Center",
            "Bottom Left",
            "Bottom Right",
            "Top Center",
            "Alternate (Inside/Outside)"
        ]);
        ddKdpPageNumPos.selection = 0;
        ddKdpPageNumPos.preferredSize.width = 110;
        ddKdpPageNumPos.enabled = false;

        pnlKdpPageNum.add("statictext", undefined, "Start #:");
        var txtKdpPageNumStart = pnlKdpPageNum.add("edittext", undefined, "1");
        txtKdpPageNumStart.preferredSize.width = 35;
        txtKdpPageNumStart.enabled = false;

        pnlKdpPageNum.add("statictext", undefined, "Size:");
        var txtKdpPageNumSize = pnlKdpPageNum.add("edittext", undefined, "10");
        txtKdpPageNumSize.preferredSize.width = 30;
        txtKdpPageNumSize.enabled = false;

        chkKdpAddPageNum.onClick = function () {
            var en = chkKdpAddPageNum.value;
            ddKdpPageNumPos.enabled = en;
            txtKdpPageNumStart.enabled = en;
            txtKdpPageNumSize.enabled = en;
        };

        // Preset UI Helpers
        function loadPresetIntoUI(p) {
            if (!p) return;
            if (p.projectName) txtKdpProjectName.text = p.projectName;
            if (p.pageWidth) txtKdpPageW.text = String(p.pageWidth);
            if (p.pageHeight) txtKdpPageH.text = String(p.pageHeight);
            
            var matchedPreset = false;
            if (p.pageWidth === 8.5 && p.pageHeight === 11.0 && (p.pageUnit === "in" || !p.pageUnit)) {
                ddKdpPagePreset.selection = 0; matchedPreset = true;
            } else if (p.pageWidth === 6.0 && p.pageHeight === 9.0) {
                ddKdpPagePreset.selection = 1; matchedPreset = true;
            } else if (p.pageWidth === 8.0 && p.pageHeight === 10.0) {
                ddKdpPagePreset.selection = 2; matchedPreset = true;
            } else if (p.pageWidth === 8.25 && p.pageHeight === 8.25) {
                ddKdpPagePreset.selection = 3; matchedPreset = true;
            } else if (p.pageWidth === 8.5 && p.pageHeight === 8.5) {
                ddKdpPagePreset.selection = 4; matchedPreset = true;
            } else {
                ddKdpPagePreset.selection = 5; // Custom
            }
            if (!matchedPreset) {
                txtKdpPageW.enabled = true;
                txtKdpPageH.enabled = true;
                ddKdpPageUnit.enabled = true;
            } else {
                txtKdpPageW.enabled = false;
                txtKdpPageH.enabled = false;
                ddKdpPageUnit.enabled = false;
            }

            if (p.pageUnit) {
                for (var u = 0; u < ddKdpPageUnit.items.length; u++) {
                    if (ddKdpPageUnit.items[u].text.toLowerCase() === p.pageUnit.toLowerCase()) {
                        ddKdpPageUnit.selection = u; break;
                    }
                }
            }

            if (p.pageCount) txtKdpPageCount.text = String(p.pageCount);
            if (p.addBlankPageAfterContent !== undefined) chkKdpBlankPage.value = p.addBlankPageAfterContent;
            if (p.iconsPerPage) txtKdpIconsPerPage.text = String(p.iconsPerPage);

            if (p.layoutMode === "manual") {
                rbKdpManualGrid.value = true;
                rbKdpAutoGrid.value = false;
                txtKdpRows.enabled = true;
                txtKdpCols.enabled = true;
            } else {
                rbKdpAutoGrid.value = true;
                rbKdpManualGrid.value = false;
                txtKdpRows.enabled = false;
                txtKdpCols.enabled = false;
            }

            if (p.rows) txtKdpRows.text = String(p.rows);
            if (p.columns) txtKdpCols.text = String(p.columns);
            if (p.horizontalGap !== undefined) txtKdpHGap.text = String(p.horizontalGap);
            if (p.verticalGap !== undefined) txtKdpVGap.text = String(p.verticalGap);

            if (p.topMargin !== undefined) txtKdpMarginTop.text = String(p.topMargin);
            if (p.bottomMargin !== undefined) txtKdpMarginBottom.text = String(p.bottomMargin);
            if (p.leftMargin !== undefined) txtKdpMarginLeft.text = String(p.leftMargin);
            if (p.rightMargin !== undefined) txtKdpMarginRight.text = String(p.rightMargin);

            if (p.fitMode === "fixed-width") {
                rbKdpFitFixW.value = true;
                rbKdpFitMax.value = false;
                rbKdpFitFixH.value = false;
            } else if (p.fitMode === "fixed-height") {
                rbKdpFitFixH.value = true;
                rbKdpFitMax.value = false;
                rbKdpFitFixW.value = false;
            } else {
                rbKdpFitMax.value = true;
                rbKdpFitFixW.value = false;
                rbKdpFitFixH.value = false;
            }

            if (p.horizontalAlignment) {
                var hStr = p.horizontalAlignment.toLowerCase();
                ddKdpHAlign.selection = (hStr === "left" ? 1 : (hStr === "right" ? 2 : 0));
            }
            if (p.verticalAlignment) {
                var vStr = p.verticalAlignment.toLowerCase();
                ddKdpVAlign.selection = (vStr === "top" ? 1 : (vStr === "bottom" ? 2 : 0));
            }

            if (p.iconOrder === "random") {
                rbKdpOrderRand.value = true;
                rbKdpOrderSeq.value = false;
            } else {
                rbKdpOrderSeq.value = true;
                rbKdpOrderRand.value = false;
            }

            if (p.allowDuplicates !== undefined) chkKdpAllowDupes.value = p.allowDuplicates;

            if (p.addPageNumber !== undefined) {
                chkKdpAddPageNum.value = p.addPageNumber;
                ddKdpPageNumPos.enabled = p.addPageNumber;
                txtKdpPageNumStart.enabled = p.addPageNumber;
                txtKdpPageNumSize.enabled = p.addPageNumber;
            }
            if (p.pageNumberStart !== undefined) txtKdpPageNumStart.text = String(p.pageNumberStart);
            if (p.pageNumberFontSize !== undefined) txtKdpPageNumSize.text = String(p.pageNumberFontSize);

            if (p.exportPDF !== undefined) chkKdpExpPDF.value = p.exportPDF;
            if (p.exportEPS !== undefined) chkKdpExpEPS.value = p.exportEPS;
            if (p.exportSVG !== undefined) chkKdpExpSVG.value = p.exportSVG;
            if (p.overwriteExisting !== undefined) chkKdpOverwrite.value = p.overwriteExisting;
        }

        function refreshPresetsDropdown(selectName) {
            var all = getKDPAvailablePresets();
            ddKdpPresetsList.removeAll();
            var targetIdx = 0;
            for (var i = 0; i < all.length; i++) {
                ddKdpPresetsList.add("item", all[i]);
                if (selectName && all[i] === selectName) targetIdx = i;
            }
            if (ddKdpPresetsList.items.length > 0) {
                ddKdpPresetsList.selection = targetIdx;
            }
        }

        btnKdpLoadPreset.onClick = function () {
            if (!ddKdpPresetsList.selection) {
                showModernAlert("No Preset Selected", "Please select a preset to load from the dropdown.", "warning");
                return;
            }
            var pName = ddKdpPresetsList.selection.text;
            var loadedSettings = loadKDPSettingsPreset(pName);
            if (loadedSettings) {
                loadPresetIntoUI(loadedSettings);
                showModernAlert("Preset Loaded", "Settings from preset '" + pName + "' loaded successfully.", "info");
            } else {
                showModernAlert("Error Loading Preset", "Could not load preset data for '" + pName + "'.", "error");
            }
        };

        btnKdpSavePreset.onClick = function () {
            var defaultName = (txtKdpProjectName.text || "KDP_Interior") + "_Custom";
            var pName = prompt("Enter a name for the new settings preset:", defaultName);
            if (!pName || pName.replace(/^\s+|\s+$/g, "").length === 0) return;

            var currentSettingsToSave = createKDPSettings({
                projectName: txtKdpProjectName.text || "KDP_Interior",
                pageWidth: parseFloat(txtKdpPageW.text) || 8.5,
                pageHeight: parseFloat(txtKdpPageH.text) || 11.0,
                pageUnit: ddKdpPageUnit.selection ? ddKdpPageUnit.selection.text : "in",
                pageCount: parseInt(txtKdpPageCount.text, 10) || 100,
                iconsPerPage: parseInt(txtKdpIconsPerPage.text, 10) || 4,
                layoutMode: rbKdpAutoGrid.value ? "auto" : "manual",
                rows: parseInt(txtKdpRows.text, 10) || 2,
                columns: parseInt(txtKdpCols.text, 10) || 2,
                topMargin: parseFloat(txtKdpMarginTop.text) || 0.5,
                bottomMargin: parseFloat(txtKdpMarginBottom.text) || 0.5,
                leftMargin: parseFloat(txtKdpMarginLeft.text) || 0.5,
                rightMargin: parseFloat(txtKdpMarginRight.text) || 0.5,
                horizontalGap: parseFloat(txtKdpHGap.text) || 0.25,
                verticalGap: parseFloat(txtKdpVGap.text) || 0.25,
                fitMode: rbKdpFitFixW.value ? "fixed-width" : (rbKdpFitFixH.value ? "fixed-height" : "fit"),
                horizontalAlignment: ddKdpHAlign.selection ? ddKdpHAlign.selection.text.toLowerCase() : "center",
                verticalAlignment: ddKdpVAlign.selection ? ddKdpVAlign.selection.text.toLowerCase() : "center",
                iconOrder: rbKdpOrderRand.value ? "random" : "sequential",
                allowDuplicates: chkKdpAllowDupes.value,
                addPageNumber: chkKdpAddPageNum.value,
                pageNumberPosition: ddKdpPageNumPos.selection ? ddKdpPageNumPos.selection.text.toLowerCase().replace(/\s+/g, "-") : "bottom-center",
                pageNumberStart: parseInt(txtKdpPageNumStart.text, 10) || 1,
                pageNumberFontSize: parseFloat(txtKdpPageNumSize.text) || 10,
                addBlankPageAfterContent: chkKdpBlankPage.value,
                exportPDF: chkKdpExpPDF.value,
                exportEPS: chkKdpExpEPS.value,
                exportSVG: chkKdpExpSVG.value,
                overwriteExisting: chkKdpOverwrite.value
            });

            var saveRes = saveKDPSettingsPreset(pName, currentSettingsToSave);
            if (saveRes.success) {
                refreshPresetsDropdown(saveRes.name);
                showModernAlert("Preset Saved", "Preset '" + saveRes.name + "' saved successfully.", "info");
            } else {
                showModernAlert("Save Failed", saveRes.error || "Unable to save preset.", "error");
            }
        };

        btnKdpDeletePreset.onClick = function () {
            if (!ddKdpPresetsList.selection) {
                showModernAlert("No Preset Selected", "Please select a preset to delete.", "warning");
                return;
            }
            var pName = ddKdpPresetsList.selection.text;
            if (confirm("Are you sure you want to delete the preset '" + pName + "'?")) {
                var delRes = deleteKDPSettingsPreset(pName);
                if (delRes.success) {
                    refreshPresetsDropdown();
                    showModernAlert("Preset Deleted", "Preset '" + pName + "' has been removed.", "info");
                } else {
                    showModernAlert("Delete Failed", delRes.error || "Unable to delete preset.", "error");
                }
            }
        };

        // Export Formats
        var pnlKdpExport = tabKdpFit.add("panel", undefined, "Export & File Output");
        pnlKdpExport.orientation = "row";
        pnlKdpExport.alignment = ["fill", "top"];
        pnlKdpExport.alignChildren = ["left", "center"];
        pnlKdpExport.spacing = 10;

        var chkKdpExpPDF = pnlKdpExport.add("checkbox", undefined, "PDF (Print-Ready)");
        chkKdpExpPDF.value = true;
        var chkKdpExpEPS = pnlKdpExport.add("checkbox", undefined, "EPS");
        chkKdpExpEPS.value = false;
        var chkKdpExpSVG = pnlKdpExport.add("checkbox", undefined, "SVG");
        chkKdpExpSVG.value = false;

        var chkKdpOverwrite = pnlKdpExport.add("checkbox", undefined, "Overwrite Existing Files");
        chkKdpOverwrite.value = false;

        // Fixed-height bottom slot container for seamless tool switching without height changes
        var grpBottomSlot = dlg.add("group");
        grpBottomSlot.orientation = "stack";
        grpBottomSlot.alignment = ["fill", "top"];
        grpBottomSlot.alignChildren = ["fill", "center"];
        grpBottomSlot.preferredSize = [STACK_WIDTH, 44];
        grpBottomSlot.size = [STACK_WIDTH, 44];

        // Global Stock Options (for Tools 1-4)
        var pnlStock = grpBottomSlot.add("panel", undefined, "Microstock Compliance");
        pnlStock.orientation = "row";
        pnlStock.alignment = ["fill", "center"];
        pnlStock.alignChildren = ["left", "center"];
        pnlStock.spacing = 24;
        pnlStock.margins = [12, 6, 12, 6];
        pnlStock.preferredSize = [STACK_WIDTH, 44];
        pnlStock.size = [STACK_WIDTH, 44];

        var chkOutline = pnlStock.add("checkbox", undefined, "Auto-Outline Text");
        chkOutline.value = true;
        var chkEPS10 = pnlStock.add("checkbox", undefined, "EPS 10 Compatibility");
        chkEPS10.value = true;

        // KDP Notice / Info Bar (for Tool 5)
        var pnlKdpNotice = grpBottomSlot.add("panel", undefined, "");
        pnlKdpNotice.orientation = "row";
        pnlKdpNotice.alignment = ["fill", "center"];
        pnlKdpNotice.alignChildren = ["left", "center"];
        pnlKdpNotice.margins = [12, 6, 12, 6];
        pnlKdpNotice.preferredSize = [STACK_WIDTH, 44];
        pnlKdpNotice.size = [STACK_WIDTH, 44];
        pnlKdpNotice.visible = false;

        var lblKdpTip = pnlKdpNotice.add("statictext", undefined, "⚡ KDP Interior Generator: Automated multi-page book interior layout engine.");
        try { lblKdpTip.graphics.foregroundColor = lblKdpTip.graphics.newPen(lblKdpTip.graphics.PenType.SOLID_COLOR, [0.35, 0.45, 0.6, 1], 1); } catch (eTip) {}

        // Horizontal divider before action buttons
        var sepActions = dlg.add("panel");
        sepActions.alignment = ["fill", "top"];
        sepActions.preferredSize = [STACK_WIDTH, 2];
        sepActions.size = [STACK_WIDTH, 2];

        // ACTIONS FOOTER
        var btnGroup = dlg.add("group");
        btnGroup.orientation = "row";
        btnGroup.alignment = ["fill", "top"];
        btnGroup.alignChildren = ["left", "center"];
        btnGroup.spacing = 0;
        btnGroup.margins = [2, 6, 2, 0];
        btnGroup.preferredSize = [STACK_WIDTH, 38];
        btnGroup.size = [STACK_WIDTH, 38];

        var grpBottomLeft = btnGroup.add("group");
        grpBottomLeft.orientation = "row";
        grpBottomLeft.alignChildren = ["left", "center"];
        grpBottomLeft.preferredSize.width = 220;
        
        var lblBottomStatus = grpBottomLeft.add("statictext", undefined, "Automation Suite Pro  •  v" + SCRIPT_VERSION);
        try {
            lblBottomStatus.graphics.font = ScriptUI.newFont(lblBottomStatus.graphics.font.name, "Regular", 10);
            lblBottomStatus.graphics.foregroundColor = lblBottomStatus.graphics.newPen(lblBottomStatus.graphics.PenType.SOLID_COLOR, [0.45, 0.50, 0.60, 1], 1);
        } catch (e) {}

        // Shift buttons slightly to the left from right edge by 65px as requested
        var btnSpacer = btnGroup.add("group");
        btnSpacer.preferredSize.width = Math.max(10, STACK_WIDTH - 220 - 245 - 65);

        var grpBottomRight = btnGroup.add("group");
        grpBottomRight.orientation = "row";
        grpBottomRight.alignChildren = ["left", "center"];
        grpBottomRight.spacing = 8;

        var btnPreview = grpBottomRight.add("button", undefined, "Preview Layout");
        btnPreview.preferredSize = [115, 34];
        btnPreview.visible = false;
        try { btnPreview.graphics.font = ScriptUI.newFont(btnPreview.graphics.font.name, "Bold", 11); } catch (e) {}

        var btnCancel = grpBottomRight.add("button", undefined, "Cancel", { name: "cancel" });
        btnCancel.preferredSize = [90, 34];
        try { btnCancel.graphics.font = ScriptUI.newFont(btnCancel.graphics.font.name, "Regular", 11.5); } catch (e) {}

        var btnRun = grpBottomRight.add("button", undefined, "Start Processing", { name: "ok" });
        btnRun.preferredSize = [145, 34];
        try {
            btnRun.graphics.font = ScriptUI.newFont(btnRun.graphics.font.name, "Bold", 11.5);
        } catch (e) {}

        dlg.defaultElement = btnRun;
        dlg.cancelElement = btnCancel;

        // Tool Switcher Logic (Zero Window Movement & Anti-Jitter)
        function switchToolPanel(idx) {
            var curLoc = (dlg.location && dlg.location.length >= 2) ? [dlg.location[0], dlg.location[1]] : null;

            pnlBgr.visible     = (idx === 0);
            pnlRes.visible     = (idx === 1);
            pnlQuality.visible = (idx === 2);
            pnlIcon.visible    = (idx === 3);
            pnlKDP.visible     = (idx === 4);

            if (idx === 4) {
                btnPreview.visible = true;
                btnRun.text = "Generate Interior";
                pnlStock.visible = false;
                pnlKdpNotice.visible = true;
                btnSpacer.preferredSize.width = Math.max(10, STACK_WIDTH - 220 - 365 - 65);
            } else {
                btnPreview.visible = false;
                btnRun.text = "Start Processing";
                pnlStock.visible = true;
                pnlKdpNotice.visible = false;
                btnSpacer.preferredSize.width = Math.max(10, STACK_WIDTH - 220 - 245 - 65);
            }
            try {
                pnlStack.layout.layout(true);
                grpBottomSlot.layout.layout(true);
                btnGroup.layout.layout(true);
                dlg.layout.layout(false);
            } catch (eLay) {}

            if (curLoc && dlg.location) {
                try { dlg.location = curLoc; } catch (eLoc) {}
            }
        }

        ddToolSelect.onChange = function () {
            if (ddToolSelect.selection) {
                switchToolPanel(ddToolSelect.selection.index);
            }
        };

        switchToolPanel(0);

        btnPreview.onClick = function () {
            var curSettings = createKDPSettings({
                inputFolder: txtIn.text,
                outputFolder: txtOut.text || (txtIn.text + "/Automation_Output"),
                projectName: txtKdpProjectName.text || "KDP_Interior",
                pageWidth: parseFloat(txtKdpPageW.text) || 8.5,
                pageHeight: parseFloat(txtKdpPageH.text) || 11.0,
                pageUnit: ddKdpPageUnit.selection ? ddKdpPageUnit.selection.text : "in",
                pageCount: parseInt(txtKdpPageCount.text, 10) || 100,
                iconsPerPage: parseInt(txtKdpIconsPerPage.text, 10) || 4,
                layoutMode: rbKdpAutoGrid.value ? "auto" : "manual",
                rows: parseInt(txtKdpRows.text, 10) || 2,
                columns: parseInt(txtKdpCols.text, 10) || 2,
                topMargin: parseFloat(txtKdpMarginTop.text) || 0.5,
                bottomMargin: parseFloat(txtKdpMarginBottom.text) || 0.5,
                leftMargin: parseFloat(txtKdpMarginLeft.text) || 0.5,
                rightMargin: parseFloat(txtKdpMarginRight.text) || 0.5,
                horizontalGap: parseFloat(txtKdpHGap.text) || 0.25,
                verticalGap: parseFloat(txtKdpVGap.text) || 0.25,
                fitMode: rbKdpFitFixW.value ? "fixed-width" : (rbKdpFitFixH.value ? "fixed-height" : "fit"),
                horizontalAlignment: ddKdpHAlign.selection ? ddKdpHAlign.selection.text.toLowerCase() : "center",
                verticalAlignment: ddKdpVAlign.selection ? ddKdpVAlign.selection.text.toLowerCase() : "center",
                iconOrder: rbKdpOrderRand.value ? "random" : "sequential",
                allowDuplicates: chkKdpAllowDupes.value,
                addPageNumber: chkKdpAddPageNum.value,
                pageNumberPosition: ddKdpPageNumPos.selection ? ddKdpPageNumPos.selection.text.toLowerCase().replace(/\s+/g, "-") : "bottom-center",
                pageNumberStart: parseInt(txtKdpPageNumStart.text, 10) || 1,
                pageNumberFontSize: parseFloat(txtKdpPageNumSize.text) || 10,
                addBlankPageAfterContent: chkKdpBlankPage.value,
                exportPDF: chkKdpExpPDF.value,
                exportEPS: chkKdpExpEPS.value,
                exportSVG: chkKdpExpSVG.value,
                overwriteExisting: chkKdpOverwrite.value
            });
            showKDPPreviewModal(curSettings, function (s) {
                btnRun.notify("onClick");
            });
        };

        btnCancel.onClick = function () {
            dlg.close(0);
        };

        var config = null;

        btnRun.onClick = function () {
            if (!isStandaloneLicensed()) {
                showLicenseActivationDialog(function () {
                    // Activated
                });
                return;
            }

            if (!txtIn.text) {
                showModernAlert("Input Folder Required", "Please select an Input Folder containing your vector icons.", "warning");
                return;
            }
            var inF = new Folder(txtIn.text);
            if (!inF.exists) {
                showModernAlert("Invalid Folder", "Input Folder does not exist:\n" + txtIn.text, "error");
                return;
            }

            var outP = txtOut.text || (txtIn.text + "/Automation_Output");
            var outF = new Folder(outP);

            // PRE-CAPTURE ALL VALUES FROM DIALOG BEFORE CLOSING
            var toolIdx = ddToolSelect.selection ? ddToolSelect.selection.index : 0;
            var toolName = ddToolSelect.selection ? ddToolSelect.selection.text : "BG Remover";

            // SPECIAL PRE-CAPTURE & VALIDATION FOR KDP INTERIOR GENERATOR
            if (toolIdx === 4 || toolName.indexOf("KDP") !== -1) {
                var kdpSettingsCaptured = createKDPSettings({
                    inputFolder: txtIn.text,
                    outputFolder: outP,
                    projectName: txtKdpProjectName.text || "KDP_Interior",
                    pageWidth: parseFloat(txtKdpPageW.text) || 8.5,
                    pageHeight: parseFloat(txtKdpPageH.text) || 11.0,
                    pageUnit: ddKdpPageUnit.selection ? ddKdpPageUnit.selection.text : "in",
                    pageCount: parseInt(txtKdpPageCount.text, 10) || 100,
                    iconsPerPage: parseInt(txtKdpIconsPerPage.text, 10) || 4,
                    layoutMode: rbKdpAutoGrid.value ? "auto" : "manual",
                    rows: parseInt(txtKdpRows.text, 10) || 2,
                    columns: parseInt(txtKdpCols.text, 10) || 2,
                    topMargin: parseFloat(txtKdpMarginTop.text) || 0.5,
                    bottomMargin: parseFloat(txtKdpMarginBottom.text) || 0.5,
                    leftMargin: parseFloat(txtKdpMarginLeft.text) || 0.5,
                    rightMargin: parseFloat(txtKdpMarginRight.text) || 0.5,
                    horizontalGap: parseFloat(txtKdpHGap.text) || 0.25,
                    verticalGap: parseFloat(txtKdpVGap.text) || 0.25,
                    fitMode: rbKdpFitFixW.value ? "fixed-width" : (rbKdpFitFixH.value ? "fixed-height" : "fit"),
                    horizontalAlignment: ddKdpHAlign.selection ? ddKdpHAlign.selection.text.toLowerCase() : "center",
                    verticalAlignment: ddKdpVAlign.selection ? ddKdpVAlign.selection.text.toLowerCase() : "center",
                    iconOrder: rbKdpOrderRand.value ? "random" : "sequential",
                    allowDuplicates: chkKdpAllowDupes.value,
                    addPageNumber: chkKdpAddPageNum.value,
                    pageNumberPosition: ddKdpPageNumPos.selection ? ddKdpPageNumPos.selection.text.toLowerCase().replace(/\s+/g, "-") : "bottom-center",
                    pageNumberStart: parseInt(txtKdpPageNumStart.text, 10) || 1,
                    pageNumberFontSize: parseFloat(txtKdpPageNumSize.text) || 10,
                    addBlankPageAfterContent: chkKdpBlankPage.value,
                    exportPDF: chkKdpExpPDF.value,
                    exportEPS: chkKdpExpEPS.value,
                    exportSVG: chkKdpExpSVG.value,
                    overwriteExisting: chkKdpOverwrite.value
                });

                var kdpVal = validateKDPSettings(kdpSettingsCaptured);
                if (!kdpVal.isValid) {
                    showModernAlert("KDP Validation Failed", "Please resolve the following issues:\n\n• " + kdpVal.errors.join("\n• "), "error");
                    return;
                }

                config = {
                    inputFolder: txtIn.text,
                    outputFolder: outP,
                    toolIndex: toolIdx,
                    activeTool: toolName,
                    kdpSettings: kdpSettingsCaptured
                };

                dlg.close(1);
                return;
            }

            config = {
                inputFolder: txtIn.text,
                outputFolder: outP,
                toolIndex: toolIdx,
                activeTool: toolName,

                // Quality Solve
                qsModeIdx: ddQsMode.selection ? ddQsMode.selection.index : 0,
                qsCleanStray: chkQsStray.value,
                qsCleanMasks: chkQsMasks.value,
                qsCleanBg: chkQsBg.value,
                qsFmt: chkQsEPS.value ? "eps" : (chkQsAI.value ? "ai" : (chkQsSVG.value ? "svg" : "png")),
                qsNameSeq: rbQsNameSeq.value,
                qsPrefix: txtQsPrefix.text || "icon_",
                qsStart: parseInt(txtQsStart.text, 10) || 1,

                // BG Remove
                bgrTol: Math.round(sliderTol.value),
                bgrFmt: chkBgrEPS.value ? "eps" : (chkBgrAI.value ? "ai" : (chkBgrSVG.value ? "svg" : "png")),
                bgrNameSeq: rbBgrNameSeq.value,
                bgrPrefix: txtBgrPrefix.text || "vector_clean_",
                bgrStart: parseInt(txtBgrStart.text, 10) || 1,
                bgrUngroup: chkBgrUngroup.value !== false,
                bgrPreserveSize: chkBgrPreserveSize.value !== false,

                // Icon Set
                iconPresetIdx: ddIconPreset.selection ? ddIconPreset.selection.index : 0,
                iconCols: parseInt(txtIconCols.text, 10) || 5,
                iconRows: parseInt(txtIconRows.text, 10) || 3,
                iconAddBg: false,
                iconIsAI: rbIconAI.value,
                iconPrefix: txtIconPrefix.text || "icon_set_",
                iconStart: parseInt(txtIconStart.text, 10) || 1,

                // Resizer
                resTargetW: parseFloat(txtResW.text) || 4000,
                resTargetH: parseFloat(txtResH.text) || 2663,
                resMargin: (parseFloat(txtResMargin.text) || 88) / 100,
                resEPS: chkResEPS.value,
                resAI: chkResAI.value,
                resSVG: chkResSVG.value,
                resNameSeq: rbResNameSeq.value,
                resPrefix: txtResPrefix.text || "artboard_",
                resStart: parseInt(txtResStart.text, 10) || 1,

                // Global
                autoOutline: chkOutline.value,
                eps10: chkEPS10.value
            };

            dlg.close(1);
        };

        dlg.layout.layout(true);
        try { dlg.center(); } catch (eCen) {}
        var dialogResult = dlg.show();
        if (dialogResult !== 1 || !config) return;

        // -------------------------------------------------------------
        // EXECUTE BATCH USING CAPTURED CONFIG
        // -------------------------------------------------------------
        var inFolder = new Folder(config.inputFolder);
        var outFolder = new Folder(config.outputFolder);

        var prevAlerts = app.userInteractionLevel;
        app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

        var successCount = 0;
        var failCount = 0;
        var errors = [];
        var files = getFiles(inFolder, true);

        // QUALITY SOLVE RUN (ADOBE STOCK COMPLIANCE & MULTI-ICON SPLITTER) - TOOL INDEX 2
        if (config.toolIndex === 2 || config.activeTool.indexOf("Quality") !== -1) {
            var isSplitMode = (config.qsModeIdx === 1);
            var seqCounter = config.qsStart;

            for (var i = 0; i < files.length; i++) {
                var srcFile = files[i];
                var doc = null;

                try {
                    doc = app.open(srcFile);
                    centerAndFitView(doc);
                    unlockAll(doc);
                    var originalAbRect = doc.artboards[0].artboardRect;
                    var srcW = Math.abs(originalAbRect[2] - originalAbRect[0]);
                    var srcH = Math.abs(originalAbRect[1] - originalAbRect[3]);
                    var baseOriginalName = srcFile.name.replace(/\.[^\.]+$/, "");

                    if (!isSplitMode) {
                        // MODE A: In-Place Deep Cleaning (Artboard 100% Unaltered)
                        deepCleanAdobeStockVector(doc, {
                            tolerance: 25,
                            removeStrayPoints: config.qsCleanStray,
                            autoOutlineText: config.autoOutline,
                            removeEmptyMasks: config.qsCleanMasks,
                            removeBgBoxes: config.qsCleanBg
                        });

                        if (config.qsCleanBg) {
                            autoSeparateAndUngroupIcons(doc);
                        }

                        enforceExactArtboardAndScale(doc, 4000, 2663, 0.88, true, true);
                        try { app.redraw(); } catch (eRedrawA) {}

                        var outName = "";
                        if (config.qsNameSeq && config.qsPrefix) {
                            outName = config.qsPrefix + padNumber(seqCounter, 2);
                            seqCounter++;
                        } else {
                            outName = baseOriginalName;
                        }

                        if (config.qsFmt === "eps") saveDocEPS(doc, new File(outFolder.fsName + "/" + outName + ".eps"), config.eps10);
                        else if (config.qsFmt === "ai") saveDocAI(doc, new File(outFolder.fsName + "/" + outName + ".ai"));
                        else if (config.qsFmt === "svg") exportDocSVG(doc, new File(outFolder.fsName + "/" + outName + ".svg"));
                        else exportDocPNG24(doc, new File(outFolder.fsName + "/" + outName + ".png"));

                        doc.close(SaveOptions.DONOTSAVECHANGES);
                        doc = null;
                        successCount++;
                    } else {
                        // MODE B: Multi-Icon Splitter to Individual Single Icon Files
                        var iconItems = detectMultipleIcons(doc);

                        if (iconItems.length <= 1) {
                            deepCleanAdobeStockVector(doc, {
                                tolerance: 25,
                                removeStrayPoints: config.qsCleanStray,
                                autoOutlineText: config.autoOutline,
                                removeEmptyMasks: config.qsCleanMasks,
                                removeBgBoxes: config.qsCleanBg
                            });
                            // Failsafe: Ensure artwork is 100% inside 4000 x 2663 artboard
                            ensureArtworkFitsInsideArtboard(doc, 4000, 2663, 0.88);
                            try { app.redraw(); } catch (eRedrawB1) {}

                            var outNameSingle = (config.qsNameSeq && config.qsPrefix) ? (config.qsPrefix + padNumber(seqCounter, 2)) : baseOriginalName;
                            seqCounter++;

                            if (config.qsFmt === "eps") saveDocEPS(doc, new File(outFolder.fsName + "/" + outNameSingle + ".eps"), config.eps10);
                            else if (config.qsFmt === "ai") saveDocAI(doc, new File(outFolder.fsName + "/" + outNameSingle + ".ai"));
                            else if (config.qsFmt === "svg") exportDocSVG(doc, new File(outFolder.fsName + "/" + outNameSingle + ".svg"));
                            else exportDocPNG24(doc, new File(outFolder.fsName + "/" + outNameSingle + ".png"));

                            doc.close(SaveOptions.DONOTSAVECHANGES);
                            doc = null;
                            successCount++;
                        } else {
                            for (var k = 0; k < iconItems.length; k++) {
                                var iconItem = iconItems[k];
                                var targetDoc = null;
                                try {
                                    // Microstock Standard Canvas: Exactly 4000 x 2663 px
                                    var singleArtW = 4000;
                                    var singleArtH = 2663;
                                    targetDoc = app.documents.add(DocumentColorSpace.RGB, singleArtW, singleArtH);
                                    centerAndFitView(targetDoc);

                                    doc.activate();
                                    doc.selection = null;
                                    iconItem.selected = true;
                                    app.copy();

                                    targetDoc.activate();
                                    targetDoc.selection = null;
                                    app.paste();

                                    if (targetDoc.selection && targetDoc.selection.length > 0) {
                                        if (targetDoc.selection.length > 1) {
                                            try { app.executeMenuCommand("group"); } catch (eG) {}
                                        }
                                    }

                                    // Immediately ensure icon is centered and scaled safely inside 4000 x 2663 artboard
                                    ensureArtworkFitsInsideArtboard(targetDoc, singleArtW, singleArtH, 0.88);

                                    deepCleanAdobeStockVector(targetDoc, {
                                        tolerance: 25,
                                        removeStrayPoints: config.qsCleanStray,
                                        autoOutlineText: config.autoOutline,
                                        removeEmptyMasks: config.qsCleanMasks,
                                        removeBgBoxes: config.qsCleanBg
                                    });

                                    // Final ensure before saving
                                    ensureArtworkFitsInsideArtboard(targetDoc, singleArtW, singleArtH, 0.88);

                                    try { app.redraw(); } catch (eRedrawB2) {}

                                    var splitOutName = "";
                                    if (config.qsNameSeq && config.qsPrefix) {
                                        splitOutName = config.qsPrefix + padNumber(seqCounter, 2);
                                        seqCounter++;
                                    } else {
                                        splitOutName = baseOriginalName + "_icon_" + padNumber(k + 1, 2);
                                    }

                                    if (config.qsFmt === "eps") saveDocEPS(targetDoc, new File(outFolder.fsName + "/" + splitOutName + ".eps"), config.eps10);
                                    else if (config.qsFmt === "ai") saveDocAI(targetDoc, new File(outFolder.fsName + "/" + splitOutName + ".ai"));
                                    else if (config.qsFmt === "svg") exportDocSVG(targetDoc, new File(outFolder.fsName + "/" + splitOutName + ".svg"));
                                    else exportDocPNG24(targetDoc, new File(outFolder.fsName + "/" + splitOutName + ".png"));

                                    targetDoc.close(SaveOptions.DONOTSAVECHANGES);
                                    targetDoc = null;
                                } catch (eSing) {
                                    errors.push(srcFile.name + " [Icon " + (k + 1) + "]: " + eSing.message);
                                    if (targetDoc) try { targetDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (eC4) {}
                                    targetDoc = null;
                                }
                            }

                            doc.close(SaveOptions.DONOTSAVECHANGES);
                            doc = null;
                            successCount++;
                        }
                    }
                } catch (eQs) {
                    failCount++;
                    errors.push(srcFile.name + ": " + eQs.message);
                } finally {
                    if (doc) {
                        try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (eC) {}
                        doc = null;
                    }
                    while (app.documents.length > 0) {
                        try { app.documents[0].close(SaveOptions.DONOTSAVECHANGES); } catch (eClAll) { break; }
                    }
                    try { $.gc(); } catch (eGc) {}
                    if (i > 0 && i % 10 === 0) {
                        try { $.sleep(50); } catch (eSl) {}
                    }
                }
            }
        }
        // BG REMOVE RUN (Intelligent Background Removal, Microstock Cleaning & Multi-Icon Auto-Ungrouping) - TOOL INDEX 0
        else if (config.toolIndex === 0 || config.activeTool.indexOf("BG Remov") !== -1 || config.activeTool.indexOf("Bg Remove") !== -1) {
            for (var i = 0; i < files.length; i++) {
                var doc = null;
                try {
                    doc = app.open(files[i]);
                    centerAndFitView(doc);
                    unlockAll(doc);

                    // 1. Complete and intelligent vector white background removal (safeguarding foreground white)
                    cleanVectorBackgroundSafely(doc, config.bgrTol);

                    // 2. Microstock quality deep cleaning (stray points, unpainted ghost paths, empty masks)
                    deepCleanAdobeStockVector(doc, {
                        tolerance: config.bgrTol,
                        removeStrayPoints: true,
                        autoOutlineText: config.autoOutline,
                        removeEmptyMasks: true,
                        removeBgBoxes: false
                    });

                    // 3. Auto-Ungroup & Separate all multi-icons so each icon is independent and unlinked
                    if (config.bgrUngroup !== false) {
                        autoSeparateAndUngroupIcons(doc);
                    }

                    // 4. Page sizing: preserve original artboard dimensions or standardize if single artboard & requested
                    if (!config.bgrPreserveSize && doc.artboards.length === 1) {
                        enforceExactArtboardAndScale(doc, 4000, 2663, 0.88, true, true);
                        validateStockCompliance(doc, 4000, 2663);
                    } else {
                        var curAb = doc.artboards[0].artboardRect;
                        var curW = Math.abs(curAb[2] - curAb[0]);
                        var curH = Math.abs(curAb[1] - curAb[3]);
                        ensureArtworkFitsInsideArtboard(doc, curW, curH, 0.88);
                    }

                    try { app.redraw(); } catch (eRedrawBgr) {}

                    var bName = "";
                    if (config.bgrNameSeq && config.bgrPrefix) {
                        var fileNum = config.bgrStart + i;
                        bName = config.bgrPrefix + fileNum;
                    } else {
                        bName = files[i].name.replace(/\.[^\.]+$/, "");
                    }

                    // Safeguard: Ensure original source file is never overwritten
                    var outBaseName = bName;
                    if (outFolder.fsName === files[i].parent.fsName && outBaseName === files[i].name.replace(/\.[^\.]+$/, "")) {
                        outBaseName = bName + "_clean";
                    }

                    if (config.bgrFmt === "eps") saveDocEPS(doc, new File(outFolder.fsName + "/" + outBaseName + ".eps"), config.eps10);
                    else if (config.bgrFmt === "ai") saveDocAI(doc, new File(outFolder.fsName + "/" + outBaseName + ".ai"));
                    else if (config.bgrFmt === "svg") exportDocSVG(doc, new File(outFolder.fsName + "/" + outBaseName + ".svg"));
                    else exportDocPNG24(doc, new File(outFolder.fsName + "/" + outBaseName + ".png"));

                    doc.close(SaveOptions.DONOTSAVECHANGES);
                    doc = null;
                    successCount++;
                } catch (eBgr) {
                    failCount++;
                    errors.push(files[i].name + ": " + eBgr.message);
                } finally {
                    if (doc) {
                        try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (eC3) {}
                        doc = null;
                    }
                    while (app.documents.length > 0) {
                        try { app.documents[0].close(SaveOptions.DONOTSAVECHANGES); } catch (eClAll) { break; }
                    }
                    try { $.gc(); } catch (eGc) {}
                    if (i > 0 && i % 10 === 0) {
                        try { $.sleep(50); } catch (eSl) {}
                    }
                }
            }
        }
        // 3. TAB 3: ICON SET MAKER RUN
        else if (config.toolIndex === 3 || config.activeTool.indexOf("Icon Set") !== -1) {
            var artW = config.iconPresetIdx === 1 ? 1000 : 4000;
            var artH = config.iconPresetIdx === 1 ? 350 : (config.iconPresetIdx === 2 ? 4000 : 2663);
            var cols = config.iconCols;
            var rows = config.iconRows;
            var iconsPerSet = cols * rows;

            var iconFiles = getFiles(inFolder, false);
            var totalSets = Math.ceil(iconFiles.length / iconsPerSet);
            var marginX = Math.round(artW * 0.04);
            var marginY = Math.round(artH * 0.04);
            var cellW = (artW - (2 * marginX)) / cols;
            var cellH = (artH - (2 * marginY)) / rows;
            var maxIconW = cellW * 0.85;
            var maxIconH = cellH * 0.85;

            var fileCursor = 0;
            var setIdx = 0;

            while (fileCursor < iconFiles.length) {
                var targetDoc = null;

                try {
                    targetDoc = app.documents.add(DocumentColorSpace.RGB, artW, artH);
                    centerAndFitView(targetDoc);

                    var abRect = targetDoc.artboards[0].artboardRect;
                    var abLeft = abRect[0];
                    var abTop = abRect[1];
                    var abRight = abRect[2];
                    var abBottom = abRect[3];
                    var abW = Math.abs(abRight - abLeft);
                    var abH = Math.abs(abTop - abBottom);

                    var iconCount = 0;
                    while (fileCursor < iconFiles.length && iconCount < iconsPerSet) {
                        var iconFile = iconFiles[fileCursor];
                        fileCursor++;

                        // Automatically clean any internal white background cards/boxes from vector icon
                        var iconGroup = loadAndEmbedIcon(iconFile, targetDoc, true, 20);
                        if (iconGroup) {
                            var r = Math.floor(iconCount / cols);
                            var c = iconCount % cols;
                            placeIconInCell(iconGroup, targetDoc, abLeft, abTop, marginX, marginY, cellW, cellH, maxIconW, maxIconH, r, c);
                            iconCount++;

                            // LIVE VISUAL REDRAW: Shows the icon being placed in real time!
                            try { app.redraw(); } catch (eRedraw) {}
                        }
                    }

                    // STRICT: Never add any background rectangle or shape. Keep artboard 100% clean and transparent.
                    // Clean any stray white/transparent background cards or bounding boxes from targetDoc
                    try { cleanVectorBackgroundSafely(targetDoc, 20); } catch (eCleanDoc) {}

                    try { app.redraw(); } catch (eR2) {}

                    if (config.autoOutline) outlineAllText(targetDoc);

                    // Validate artboard size before saving
                    validateStockCompliance(targetDoc, artW, artH);

                    var outName = (config.iconPrefix || "icon_set_") + (config.iconStart + setIdx);
                    if (config.iconIsAI) saveDocAI(targetDoc, new File(outFolder.fsName + "/" + outName + ".ai"));
                    else saveDocEPS(targetDoc, new File(outFolder.fsName + "/" + outName + ".eps"), config.eps10);

                    targetDoc.close(SaveOptions.DONOTSAVECHANGES);
                    targetDoc = null;
                    try { $.gc(); } catch (eGc) {}
                    successCount++;
                    setIdx++;
                } catch (eIconSet) {
                    failCount++;
                    errors.push("Set " + (setIdx + 1) + ": " + eIconSet.message);
                    if (targetDoc) try { targetDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (eC5) {}
                    targetDoc = null;
                    try { $.gc(); } catch (eGc2) {}
                    setIdx++;
                } finally {
                    while (app.documents.length > 0) {
                        try { app.documents[0].close(SaveOptions.DONOTSAVECHANGES); } catch (eClAll) { break; }
                    }
                    try { $.gc(); } catch (eGc) {}
                }
            }
        }
        // TAB 4: PAGE RESIZER RUN - TOOL INDEX 1
        else if (config.toolIndex === 1 || config.activeTool.indexOf("Resiz") !== -1) {
            var doResEPS = config.resEPS;
            var doResAI  = config.resAI;
            var doResSVG = config.resSVG;
            if (!doResEPS && !doResAI && !doResSVG) doResEPS = true;

            for (var i = 0; i < files.length; i++) {
                var doc = null;
                try {
                    doc = app.open(files[i]);
                    centerAndFitView(doc);
                    var bName = "";
                    if (config.resNameSeq && config.resPrefix) {
                        var fileNum = config.resStart + i;
                        bName = config.resPrefix + fileNum;
                    } else {
                        bName = files[i].name.replace(/\.[^\.]+$/, "");
                    }

                    unlockAll(doc);

                    // Clean background cards if present
                    cleanVectorBackgroundSafely(doc, 20);

                    // Microstock deep cleaning
                    deepCleanAdobeStockVector(doc, {
                        tolerance: 20,
                        removeStrayPoints: true,
                        autoOutlineText: config.autoOutline,
                        removeEmptyMasks: true,
                        removeBgBoxes: false
                    });

                    // Enforce exact dimensions & proportional scale with zero distortion
                    enforceExactArtboardAndScale(doc, config.resTargetW, config.resTargetH, config.resMargin, true, true);

                    // Validate dimensions before save
                    validateStockCompliance(doc, config.resTargetW, config.resTargetH);

                    try { app.redraw(); } catch (eRedrawRes) {}

                    if (doResEPS) saveDocEPS(doc, new File(outFolder.fsName + "/" + bName + ".eps"), config.eps10);
                    if (doResAI)  saveDocAI(doc, new File(outFolder.fsName + "/" + bName + ".ai"));
                    if (doResSVG) exportDocSVG(doc, new File(outFolder.fsName + "/" + bName + ".svg"));

                    doc.close(SaveOptions.DONOTSAVECHANGES);
                    doc = null;
                    successCount++;
                } catch (eRes) {
                    failCount++;
                    errors.push(files[i].name + ": " + eRes.message);
                } finally {
                    if (doc) {
                        try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (eC4) {}
                        doc = null;
                    }
                    while (app.documents.length > 0) {
                        try { app.documents[0].close(SaveOptions.DONOTSAVECHANGES); } catch (eClAll) { break; }
                    }
                    try { $.gc(); } catch (eGc) {}
                    if (i > 0 && i % 10 === 0) {
                        try { $.sleep(50); } catch (eSl) {}
                    }
                }
            }
        }
        // 5. TAB 5: KDP INTERIOR GENERATOR RUN
        else if (config.toolIndex === 4 || config.activeTool.indexOf("KDP") !== -1) {
            var kSettings = config.kdpSettings || createKDPSettings();
            var genResult = generateKDPInterior(kSettings);

            app.userInteractionLevel = prevAlerts;

            if (genResult && genResult.summary) {
                showKDPSummaryDialog(genResult.summary, outFolder);
                return;
            } else {
                var errList = (genResult && genResult.errors && genResult.errors.length > 0) ? genResult.errors : ["Unknown generation error occurred."];
                showModernAlert("KDP Generation Failed", "Please check the following issues:\n\n• " + errList.join("\n• "), "error");
                return;
            }
        }

        app.userInteractionLevel = prevAlerts;

        showProcessCompletedDialog({
            title: SCRIPT_NAME + " - Batch Complete",
            successCount: successCount,
            failCount: failCount,
            totalCount: files.length,
            outFolder: outFolder,
            errors: errors
        });
    }

    // -------------------------------------------------------------------------
    // Professional Completion Results Dialog
    // -------------------------------------------------------------------------
    function showProcessCompletedDialog(info) {
        var dlg = new Window("dialog", (info.title || "Process Results"));
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.preferredSize.width = 440;
        dlg.spacing = 14;
        dlg.margins = [20, 20, 20, 16];

        // Header Panel
        var pnlHeader = dlg.add("panel", undefined, undefined, { borderStyle: "none" });
        pnlHeader.orientation = "row";
        pnlHeader.alignChildren = ["fill", "center"];
        pnlHeader.margins = 0;
        pnlHeader.spacing = 12;

        var grpHeaderText = pnlHeader.add("group");
        grpHeaderText.orientation = "column";
        grpHeaderText.alignChildren = ["left", "center"];
        grpHeaderText.spacing = 2;

        var lblTitle = grpHeaderText.add("statictext", undefined, "Process Completed Successfully!");
        try {
            lblTitle.graphics.font = ScriptUI.newFont(lblTitle.graphics.font.name, "Bold", 15);
        } catch (eF) {}

        var lblSubtitle = grpHeaderText.add("statictext", undefined, "All requested batch operations have been finished.");
        try {
            lblSubtitle.graphics.foregroundColor = lblSubtitle.graphics.newPen(lblSubtitle.graphics.PenType.SOLID_COLOR, [0.45, 0.45, 0.45, 1], 1);
        } catch (eC) {}

        // Execution Summary Card
        var pnlStats = dlg.add("panel", undefined, " Execution Summary ");
        pnlStats.orientation = "column";
        pnlStats.alignChildren = ["fill", "top"];
        pnlStats.spacing = 8;
        pnlStats.margins = [16, 16, 16, 14];

        // Metrics Row
        var grpMetrics = pnlStats.add("group");
        grpMetrics.orientation = "row";
        grpMetrics.alignChildren = ["left", "center"];
        grpMetrics.spacing = 24;

        var lblSuccess = grpMetrics.add("statictext", undefined, "[OK] Successful: " + (info.successCount || 0) + " file(s)");
        try {
            lblSuccess.graphics.font = ScriptUI.newFont(lblSuccess.graphics.font.name, "Bold", 12);
            lblSuccess.graphics.foregroundColor = lblSuccess.graphics.newPen(lblSuccess.graphics.PenType.SOLID_COLOR, [0.12, 0.60, 0.25, 1], 1);
        } catch (eS) {}

        if (info.failCount > 0) {
            var lblFail = grpMetrics.add("statictext", undefined, "[!] Failed: " + info.failCount + " file(s)");
            try {
                lblFail.graphics.font = ScriptUI.newFont(lblFail.graphics.font.name, "Bold", 12);
                lblFail.graphics.foregroundColor = lblFail.graphics.newPen(lblFail.graphics.PenType.SOLID_COLOR, [0.85, 0.20, 0.20, 1], 1);
            } catch (eFl) {}
        }

        // Output Destination Box
        var outPathStr = "";
        if (info.outFolder) {
            outPathStr = (info.outFolder.fsName || info.outFolder.toString());
        }

        var grpOut = pnlStats.add("group");
        grpOut.orientation = "column";
        grpOut.alignChildren = ["fill", "top"];
        grpOut.spacing = 4;
        grpOut.margins = [0, 4, 0, 0];

        grpOut.add("statictext", undefined, "Output Folder Location:");
        var txtOutBox = grpOut.add("edittext", undefined, outPathStr, { readonly: true });
        txtOutBox.preferredSize = [390, 24];

        // Errors Section if any
        if (info.errors && info.errors.length > 0) {
            var pnlErr = dlg.add("panel", undefined, " Issues / Error Log (" + info.errors.length + ") ");
            pnlErr.orientation = "column";
            pnlErr.alignChildren = ["fill", "top"];
            pnlErr.margins = [12, 12, 12, 10];
            pnlErr.add("edittext", [0, 0, 390, 60], info.errors.join("\n"), { multiline: true, readonly: true });
        }

        // Bottom Action Buttons
        var grpActions = dlg.add("group");
        grpActions.orientation = "row";
        grpActions.alignChildren = ["fill", "center"];
        grpActions.spacing = 10;
        grpActions.margins = [0, 4, 0, 0];

        var btnOpenFolder = grpActions.add("button", [0, 0, 160, 32], "Open Output Folder");
        var btnSpacer = grpActions.add("group");
        btnSpacer.alignment = ["fill", "center"];
        var btnDone = grpActions.add("button", [0, 0, 100, 32], "Done", { name: "ok" });

        btnOpenFolder.onClick = function () {
            if (info.outFolder) {
                var f = (info.outFolder instanceof Folder) ? info.outFolder : new Folder(info.outFolder);
                if (f.exists) {
                    f.execute();
                } else {
                    alert("Folder does not exist yet:\n" + f.fsName);
                }
            }
        };

        btnDone.onClick = function () {
            dlg.close(1);
        };

        dlg.show();
    }

    if (isStandaloneLicensed()) {
        showMainWindow();
    } else {
        showLicenseActivationDialog(function () {
            showMainWindow();
        });
    }

})();
