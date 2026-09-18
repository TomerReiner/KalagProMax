import React from "react";

export default function AuthLayout({ icon: Icon, imageUrl, title, titleImage, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          {imageUrl ? (
            <img src={imageUrl} alt="logo" className="w-20 h-20 rounded-2xl object-cover mx-auto mb-4" />
          ) : (
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
              <Icon className="w-7 h-7 text-primary-foreground" aria-hidden="true" />
            </div>
          )}
          {titleImage ? (
            <img src={titleImage} alt="title" className="max-w-[280px] max-h-16 object-contain mx-auto" />
          ) : (
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          )}
          {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
        </div>
        <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
          {children}
        </div>
        {footer && (
          <div className="text-center text-sm text-muted-foreground mt-6">{footer}</div>
        )}
      </div>
    </div>
  );
}