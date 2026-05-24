'use client';

import { motion } from 'framer-motion';

export default function MotionWrapper({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
                duration: 0.5,
                ease: 'easeOut',
            }}
            whileHover={{
                scale: 1.05,
                y: -2,
            }}
            whileTap={{
                scale: 0.97,
            }}
        >
            {children}
        </motion.div>
    );
}