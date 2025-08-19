// app/app/page.tsx
'use client'

import React, { useEffect, useRef, useState } from 'react';
import NextImage from 'next/image';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Accordion } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ModeToggle } from '@/components/mode-toggle';
import { Profile } from '@/types';
import TextCustomizer from '@/components/editor/text-customizer';

import { PlusIcon, ReloadIcon } from '@radix-ui/react-icons';
import { removeBackground } from '@imgly/background-removal';
import '@/app/fonts.css';

const Page = () => {
    const [currentUser, setCurrentUser] = useState<Profile | null>(null);

    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isImageSetupDone, setIsImageSetupDone] = useState<boolean>(false);
    const [removedBgImageUrl, setRemovedBgImageUrl] = useState<string | null>(null);
    const [textSets, setTextSets] = useState<Array<any>>([]);

    const [imgWidth, setImgWidth] = useState<number | null>(null);
    const [imgHeight, setImgHeight] = useState<number | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        setCurrentUser({
            id: 'anon',
            full_name: 'Guest',
            avatar_url: '',
            images_generated: 0,
            paid: true,
            subscription_id: null,
        } as any);
    }, []);

    const handleUploadImage = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const imageUrl = URL.createObjectURL(file);

        // Read natural dimensions so preview and canvas use original pixels
        const probe = new window.Image();
        probe.onload = () => {
            setImgWidth(probe.naturalWidth);
            setImgHeight(probe.naturalHeight);
            setSelectedImage(imageUrl);
            setIsImageSetupDone(true);
            setRemovedBgImageUrl(null);

            // Background removal async. When ready, overlay subject on top for preview
            removeBackground(imageUrl)
                .then((imageBlob) => {
                    const url = URL.createObjectURL(imageBlob);
                    setRemovedBgImageUrl(url);
                })
                .catch((err) => {
                    console.error('Background removal failed, using original image only.', err);
                });
        };
        probe.src = imageUrl;
    };

    const addNewTextSet = () => {
        const newId = Math.max(...textSets.map((set) => set.id), 0) + 1;
        setTextSets((prev) => [
            ...prev,
            {
                id: newId,
                text: 'edit',
                fontFamily: 'Inter',
                top: 0,
                left: 0,
                color: 'white',
                fontSize: 200,
                fontWeight: 800,
                opacity: 1,
                shadowColor: 'rgba(0, 0, 0, 0.8)',
                shadowSize: 4,
                rotation: 0,
                tiltX: 0,
                tiltY: 0,
                letterSpacing: 0,
            },
        ]);
    };

    const handleAttributeChange = (id: number, attribute: string, value: any) => {
        setTextSets((prev) => prev.map((set) => (set.id === id ? { ...set, [attribute]: value } : set)));
    };

    const duplicateTextSet = (textSet: any) => {
        const newId = Math.max(...textSets.map((set) => set.id), 0) + 1;
        setTextSets((prev) => [...prev, { ...textSet, id: newId }]);
    };

    const removeTextSet = (id: number) => {
        setTextSets((prev) => prev.filter((set) => set.id !== id));
    };

    const saveCompositeImage = () => {
        if (!canvasRef.current || !isImageSetupDone || !selectedImage) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const bgImg = new (window as any).Image();
        bgImg.crossOrigin = 'anonymous';
        bgImg.onload = () => {
            canvas.width = bgImg.width;
            canvas.height = bgImg.height;

            // 1) Draw original background
            ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

            // 2) Draw text (behind the subject)
            textSets.forEach((textSet) => {
                ctx.save();
                ctx.font = `${textSet.fontWeight} ${textSet.fontSize * 3}px ${textSet.fontFamily}`;
                ctx.fillStyle = textSet.color;
                ctx.globalAlpha = textSet.opacity;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                (ctx as any).letterSpacing = `${textSet.letterSpacing}px`;

                const x = (canvas.width * (textSet.left + 50)) / 100;
                const y = (canvas.height * (50 - textSet.top)) / 100;

                ctx.translate(x, y);

                const tiltXRad = (-textSet.tiltX * Math.PI) / 180;
                const tiltYRad = (-textSet.tiltY * Math.PI) / 180;
                ctx.transform(Math.cos(tiltYRad), Math.sin(0), -Math.sin(0), Math.cos(tiltXRad), 0, 0);
                ctx.rotate((textSet.rotation * Math.PI) / 180);

                if (textSet.letterSpacing === 0) {
                    ctx.fillText(textSet.text, 0, 0);
                } else {
                    const chars = textSet.text.split('');
                    let currentX = 0;
                    const totalWidth = chars.reduce((width: number, char: string, i: number) => {
                        const charWidth = ctx.measureText(char).width;
                        return width + charWidth + (i < chars.length - 1 ? textSet.letterSpacing : 0);
                    }, 0);
                    currentX = -totalWidth / 2;
                    chars.forEach((char: string) => {
                        const charWidth = ctx.measureText(char).width;
                        ctx.fillText(char, currentX + charWidth / 2, 0);
                        currentX += charWidth + textSet.letterSpacing;
                    });
                }
                ctx.restore();
            });

            // 3) Draw the foreground (subject) on top if we have it
            if (removedBgImageUrl) {
                const fg = new (window as any).Image();
                fg.crossOrigin = 'anonymous';
                fg.onload = () => {
                    ctx.drawImage(fg, 0, 0, canvas.width, canvas.height);
                    triggerDownload();
                };
                fg.src = removedBgImageUrl;
            } else {
                triggerDownload();
            }
        };
        bgImg.src = selectedImage;

        function triggerDownload() {
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = 'text-behind-image.png';
            link.href = dataUrl;
            link.click();
        }
    };

    const previewWidth = imgWidth ?? undefined;
    const previewHeight = imgHeight ?? undefined;
    const maskReady = Boolean(removedBgImageUrl);

    return (
        <>
            <script
                async
                src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1609710199882100"
                crossOrigin="anonymous"
            ></script>
            <div className="flex flex-col h-screen">
                <header className="flex flex-row items-center justify-between p-5 px-10">
                    <h2 className="text-4xl md:text-2xl font-semibold tracking-tight">
                        <span className="block md:hidden">TBI</span>
                        <span className="hidden md:block">Text behind image editor</span>
                    </h2>
                    <div className="flex gap-4 items-center">
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                            accept=".jpg, .jpeg, .png"
                        />
                        <div className="flex items-center gap-5">
                            <div className="hidden md:block font-semibold">
                                <p className="text-sm">Unlimited generations</p>
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={handleUploadImage}>Upload image</Button>
                                {selectedImage && (
                                    <Button onClick={saveCompositeImage} className="hidden md:flex">
                                        Save image
                                    </Button>
                                )}
                            </div>
                        </div>
                        <ModeToggle />
                    </div>
                </header>
                <Separator />
                {selectedImage ? (
                    <div className="flex flex-col md:flex-row items-start justify-start gap-10 w-full h-screen px-10 mt-2">
                        <div className="flex flex-col items-start justify-start w-full md:w-1/2 gap-4">
                            <canvas ref={canvasRef} style={{ display: 'none' }} />
                            <div className="flex items-center gap-2">
                                <Button onClick={saveCompositeImage} className="md:hidden">
                                    Save image
                                </Button>
                                {!isImageSetupDone && (
                                    <div className="block md:hidden">
                                        <span className="flex items-center w-full gap-2">
                                            <ReloadIcon className="animate-spin" /> Loading, please wait
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div
                                className="border border-border rounded-lg relative overflow-hidden"
                                style={{ width: previewWidth, height: previewHeight }}
                            >
                                {isImageSetupDone ? (
                                    <NextImage
                                        src={selectedImage}
                                        alt="Uploaded"
                                        width={imgWidth ?? 0}
                                        height={imgHeight ?? 0}
                                        unoptimized
                                        style={{ position: 'absolute', inset: 0, zIndex: 10, objectFit: 'contain' as any }}
                                    />
                                ) : (
                                    <span className="flex items-center w-full gap-2">
                                        <ReloadIcon className="animate-spin" /> Loading, please wait
                                    </span>
                                )}
                                {isImageSetupDone && maskReady &&
                                    textSets.map((textSet) => (
                                        <div
                                            key={textSet.id}
                                            style={{
                                                position: 'absolute',
                                                top: `${50 - textSet.top}%`,
                                                left: `${textSet.left + 50}%`,
                                                transform: `
                                                    translate(-50%, -50%)
                                                    rotate(${textSet.rotation}deg)
                                                    perspective(1000px)
                                                    rotateX(${textSet.tiltX}deg)
                                                    rotateY(${textSet.tiltY}deg)
                                                `,
                                                color: textSet.color,
                                                textAlign: 'center',
                                                fontSize: `${textSet.fontSize}px`,
                                                fontWeight: textSet.fontWeight,
                                                fontFamily: textSet.fontFamily,
                                                opacity: textSet.opacity,
                                                letterSpacing: `${textSet.letterSpacing}px`,
                                                transformStyle: 'preserve-3d',
                                                zIndex: 20,
                                            }}
                                        >
                                            {textSet.text}
                                        </div>
                                    ))}
                                {isImageSetupDone && removedBgImageUrl && (
                                    <NextImage
                                        src={removedBgImageUrl}
                                        alt="Subject"
                                        width={imgWidth ?? 0}
                                        height={imgHeight ?? 0}
                                        unoptimized
                                        style={{ position: 'absolute', inset: 0, zIndex: 30, objectFit: 'contain' as any, pointerEvents: 'none' }}
                                    />
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col w-full md:w-1/2">
                            <Button variant={'secondary'} onClick={addNewTextSet}>
                                <PlusIcon className="mr-2" /> Add New Text Set
                            </Button>
                            <ScrollArea className="h-[calc(100vh-10rem)] p-2">
                                <Accordion type="single" collapsible className="w-full mt-2">
                                    {textSets.map((textSet) => (
                                        <TextCustomizer
                                            key={textSet.id}
                                            textSet={textSet}
                                            handleAttributeChange={handleAttributeChange}
                                            removeTextSet={removeTextSet}
                                            duplicateTextSet={duplicateTextSet}
                                        />
                                    ))}
                                </Accordion>
                            </ScrollArea>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center min-h-screen w-full">
                        <h2 className="text-xl font-semibold">Welcome, get started by uploading an image!</h2>
                    </div>
                )}
            </div>
        </>
    );
};

export default Page;
