'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';

import {
  Activity,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  Trash2,
  Globe,
  AlertCircle,
  ShoppingBag,
} from 'lucide-react';

const fetcher = (url: string) =>
  fetch(url).then((res) => res.json());

export default function ReviewDraftPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const router = useRouter();

  const { jobId } = use(params);

  // =========================================================
  // JOB POLLING
  // =========================================================

  const { data, error } = useSWR(
    `/api/jobs/${jobId}`,
    fetcher,
    {
      refreshInterval: (data: any) =>
        data?.job?.status === 'COMPLETED' ||
          data?.job?.status === 'FAILED'
          ? 0
          : 1000,
    }
  );

  const job = data?.job;

  const isFinished =
    job?.status === 'COMPLETED';

  const isFailed =
    job?.status === 'FAILED';

  // =========================================================
  // FORM STATES
  // =========================================================

  const [skuId, setSkuId] =
    useState('');

  const [productTitle, setProductTitle] =
    useState('');

  const [description, setDescription] =
    useState('');

  const [brand, setBrand] =
    useState('');

  const [category, setCategory] =
    useState('');

  const [price, setPrice] = useState<
    number | string
  >('');

  const [mrp, setMrp] = useState<
    number | string
  >('');

  const [color, setColor] =
    useState('');

  const [size, setSize] =
    useState('');

  const [material, setMaterial] =
    useState('');

  const [gender, setGender] =
    useState('');

  const [imageUrl, setImageUrl] =
    useState('');

  const [confidence, setConfidence] =
    useState<number | null>(null);

  const [competitors, setCompetitors] =
    useState<any[]>([]);

  const [publishLoading, setPublishLoading] =
    useState(false);

  const [publishError, setPublishError] =
    useState('');

  // =========================================================
  // CLEAN UNKNOWN VALUES
  // =========================================================

  const cleanValue = (
    val: string | null
  ) => {
    if (
      !val ||
      val === 'Unknown' ||
      val === 'Unknown Product' ||
      val === 'General'
    ) {
      return '';
    }

    return val;
  };

  // =========================================================
  // SYNC AI DATA
  // =========================================================

  useEffect(() => {
    if (
      isFinished &&
      job?.products?.[0] &&
      skuId === ''
    ) {
      const product = job.products[0];

      setSkuId(product.skuId || '');

      setProductTitle(
        cleanValue(product.productTitle)
      );

      setDescription(
        product.description || ''
      );

      setBrand(
        cleanValue(product.brand)
      );

      setCategory(
        cleanValue(product.category)
      );

      setPrice(
        product.price &&
          product.price > 0
          ? product.price
          : ''
      );

      setMrp(
        product.mrp &&
          product.mrp > 0
          ? product.mrp
          : ''
      );

      setColor(
        cleanValue(product.color)
      );

      setSize(
        cleanValue(product.size)
      );

      setMaterial(
        cleanValue(product.material)
      );

      setGender(
        cleanValue(product.gender)
      );

      setImageUrl(
        product.imageUrl || ''
      );

      setConfidence(
        product.confidenceScore !== null
          ? Number(
            product.confidenceScore
          )
          : null
      );

      setCompetitors([]);
    }
  }, [isFinished, job, skuId]);

  // =========================================================
  // COMPETITOR FUNCTIONS
  // =========================================================

  const handleCompetitorPriceChange = (
    index: number,
    newPrice: string
  ) => {
    const updated = [...competitors];

    updated[index].price = newPrice;

    setCompetitors(updated);
  };

  const handleAddCompetitor = () => {
    setCompetitors([
      ...competitors,
      {
        platform: 'AMAZON',
        title: '',
        url: '',
        price: '',
      },
    ]);
  };

  const handleRemoveCompetitor = (
    index: number
  ) => {
    setCompetitors(
      competitors.filter(
        (_, i) => i !== index
      )
    );
  };

  // =========================================================
  // PUBLISH PRODUCT
  // =========================================================

  const handlePublishSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (
      !skuId.trim() ||
      !productTitle.trim()
    ) {
      setPublishError(
        'Business SKU and Product Title are required.'
      );

      return;
    }

    setPublishLoading(true);

    setPublishError('');

    try {
      const res = await fetch(
        '/api/review/publish',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            productId:
              job?.products?.[0]?.id,

            skuId,

            productTitle,

            description,

            brand,

            category,

            price,

            mrp,

            color,

            size,

            material,

            gender,

            imageUrl,

            competitors,

            confidenceScore:
              confidence,
          }),
        }
      );

      const resData =
        await res.json();

      if (!resData.success) {
        throw new Error(
          resData.error ||
          'Failed to publish.'
        );
      }

      if (resData.alreadyExisted) {
        router.push(`/products/${skuId}?alreadyExisted=true`);
      } else {
        router.push(`/products/${skuId}`);
      }
    } catch (err: any) {
      setPublishError(
        err.message ||
        'Publishing failed.'
      );

      setPublishLoading(false);
    }
  };

  // =========================================================
  // ERROR STATE
  // =========================================================

  if (error) {
    return (
      <div className="glass-panel p-6 rounded-2xl text-center max-w-xl mx-auto space-y-4">

        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />

        <h2 className="text-xl font-bold text-slate-800">
          Extraction Job Failed
        </h2>

        <p className="text-slate-500">
          Failed to retrieve
          extraction statuses.
        </p>

        <button
          onClick={() =>
            router.push('/upload')
          }
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          Return to Upload
        </button>
      </div>
    );
  }

  // =========================================================
  // LOADING STATE
  // =========================================================

  if (!isFinished && !isFailed) {
    const progress =
      job?.progress || 0;

    const logs =
      job?.logs || [];

    return (
      <div className="max-w-2xl mx-auto space-y-8">

        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">

          <div className="flex items-center justify-between">

            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">

              <Activity className="w-5 h-5 text-blue-600 animate-spin" />

              Ingestion Pipeline Running
            </h2>

            <span className="text-xs bg-blue-50 text-blue-600 font-bold px-2.5 py-1 rounded-full border border-blue-100">
              {job?.status}
            </span>
          </div>

          <div className="space-y-2">

            <div className="flex justify-between text-xs font-bold">

              <span>
                Extracting Attributes...
              </span>

              <span>
                {progress}%
              </span>
            </div>

            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">

              <div
                className="bg-gradient-to-r from-blue-600 to-emerald-500 h-full transition-all duration-300"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 h-60 overflow-y-auto font-mono text-[11px] text-slate-700 space-y-2">

            {logs.length === 0 ? (
              <div className="space-y-2 text-sm">
                <div className={progress >= 0 && progress < 10 ? "text-blue-600 font-bold" : "text-slate-500"}>
                  {progress > 0 ? '✔' : '•'} Connecting ingestion pipeline...
                </div>
                {progress >= 10 && (
                  <div className={progress >= 10 && progress < 25 ? "text-blue-600 font-bold animate-pulse" : "text-slate-500"}>
                    {progress >= 25 ? '✔' : '•'} Downloading video from secure cloud storage...
                  </div>
                )}
                {progress >= 25 && (
                  <div className={progress >= 25 && progress < 45 ? "text-blue-600 font-bold animate-pulse" : "text-slate-500"}>
                    {progress >= 45 ? '✔' : '•'} Extracting video frames via FFMPEG engine...
                  </div>
                )}
                {progress >= 45 && (
                  <div className={progress >= 45 && progress < 60 ? "text-blue-600 font-bold animate-pulse" : "text-slate-500"}>
                    {progress >= 60 ? '✔' : '•'} Scanning frames with Google Cloud Vision & YOLOv8...
                  </div>
                )}
                {progress >= 60 && (
                  <div className={progress >= 60 && progress < 100 ? "text-blue-600 font-bold animate-pulse" : "text-slate-500"}>
                    {progress >= 100 ? '✔' : '•'} Running Multi-Modal AI inference engine...
                  </div>
                )}
                {progress >= 100 && (
                  <div className="text-emerald-600 font-bold">
                    ✔ Extraction Completed Successfully. Generating Schema...
                  </div>
                )}
              </div>
            ) : (
              [...logs]
                .reverse()
                .map(
                  (
                    log: any,
                    idx: number
                  ) => (
                    <div
                      key={log.id}
                      className="flex gap-2"
                    >
                      <span className="text-slate-400">
                        [
                        {new Date(
                          log.createdAt
                        ).toLocaleTimeString()}
                        ]
                      </span>

                      <span
                        className={
                          idx === 0
                            ? 'text-blue-600 font-bold'
                            : ''
                        }
                      >
                        {log.message}
                      </span>
                    </div>
                  )
                )
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // FAILED STATE
  // =========================================================

  if (isFailed) {
    return (
      <div className="bg-white p-8 rounded-2xl text-center max-w-xl mx-auto space-y-4 border border-slate-200 shadow-sm">

        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />

        <h2 className="text-xl font-bold text-slate-800">
          Extraction Worker Halted
        </h2>

        <p className="text-slate-500">
          {job?.errorMessage}
        </p>

        <div className="flex gap-3 justify-center">

          <button
            onClick={() =>
              router.push('/upload')
            }
            className="px-4 py-2 border rounded-lg text-sm font-bold"
          >
            Return
          </button>

          <button
            onClick={() =>
              router.push('/upload')
            }
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // =========================================================
  // MAIN UI
  // =========================================================

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* HEADER */}

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">

        <div>

          <div className="flex gap-2 flex-wrap">

            <span className="text-xs bg-emerald-50 text-emerald-600 border border-emerald-200 font-extrabold px-2.5 py-1 rounded-full uppercase flex items-center gap-1.5">

              <CheckCircle2 className="w-3.5 h-3.5" />

              Extraction Completed
            </span>

            {confidence !== null && (
              <span
                className={`text-xs border font-extrabold px-2.5 py-1 rounded-full uppercase flex items-center gap-1.5 ${confidence >= 90
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  : confidence >= 70
                    ? 'bg-amber-50 text-amber-600 border-amber-200'
                    : 'bg-red-50 text-red-600 border-red-200'
                  }`}
              >
                AI Confidence:{' '}
                {confidence}%
              </span>
            )}
          </div>

          <h1 className="text-2xl font-extrabold text-slate-800 mt-3">
            Draft Staging Review &
            Publish
          </h1>
        </div>

        <button
          onClick={
            handlePublishSubmit
          }
          disabled={publishLoading}
          className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-lg disabled:opacity-50"
        >
          {publishLoading
            ? 'Publishing...'
            : 'Publish to Live Catalog'}

          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* WARNING */}

      {confidence !== null &&
        confidence < 75 && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 text-amber-900 shadow-sm">

            <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />

            <div>

              <h4 className="text-sm font-extrabold">
                Needs Manual Review
              </h4>

              <p className="text-xs font-semibold mt-1 leading-relaxed">
                AI confidence is low
                ({confidence}%).
                Some fields may be
                inaccurate.
              </p>
            </div>
          </div>
        )}

      {/* FORM */}

      <form
        onSubmit={
          handlePublishSubmit
        }
        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      >

        {/* LEFT */}

        <div className="lg:col-span-2 space-y-6">

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">

            <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">

              <ShoppingBag className="w-4 h-4 text-emerald-600" />

              Extracted Specifications
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* SKU */}

              <div className="space-y-1.5">

                <label className="text-xs font-bold text-slate-500 uppercase">
                  Business SKU ID *
                </label>

                <input
                  type="text"
                  value={skuId}
                  onChange={(e) =>
                    setSkuId(
                      e.target.value.toUpperCase()
                    )
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm font-bold uppercase"
                  required
                />
              </div>

              {/* BRAND */}

              <div className="space-y-1.5">

                <label className="text-xs font-bold text-slate-500 uppercase">
                  Brand Name
                </label>

                <input
                  type="text"
                  value={brand}
                  onChange={(e) =>
                    setBrand(
                      e.target.value
                    )
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm font-bold"
                />
              </div>

              {/* TITLE */}

              <div className="md:col-span-2 space-y-1.5">

                <label className="text-xs font-bold text-slate-500 uppercase">
                  Product Title *
                </label>

                <input
                  type="text"
                  value={productTitle}
                  onChange={(e) =>
                    setProductTitle(
                      e.target.value
                    )
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm font-bold"
                  required
                />
              </div>

              {/* DESCRIPTION */}

              <div className="md:col-span-2 space-y-1.5">

                <label className="text-xs font-bold text-slate-500 uppercase">
                  Description
                </label>

                <textarea
                  value={description}
                  onChange={(e) =>
                    setDescription(
                      e.target.value
                    )
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm h-28"
                />
              </div>

              {/* CATEGORY */}

              <div className="space-y-1.5">

                <label className="text-xs font-bold text-slate-500 uppercase">
                  Category
                </label>

                <input
                  type="text"
                  value={category}
                  onChange={(e) =>
                    setCategory(
                      e.target.value
                    )
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm font-bold"
                />
              </div>

              {/* PRICE */}

              <div className="space-y-1.5">

                <label className="text-xs font-bold text-slate-500 uppercase">
                  Price (INR) *
                </label>

                <input
                  type="number"
                  value={price}
                  onChange={(e) =>
                    setPrice(
                      e.target.value
                    )
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm font-bold"
                  required
                />
              </div>

              {/* MRP */}

              <div className="space-y-1.5">

                <label className="text-xs font-bold text-slate-500 uppercase">
                  MRP (INR)
                </label>

                <input
                  type="number"
                  value={mrp}
                  onChange={(e) =>
                    setMrp(
                      e.target.value
                    )
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm font-bold"
                />
              </div>

              {/* COLOR */}

              <div className="space-y-1.5">

                <label className="text-xs font-bold text-slate-500 uppercase">
                  Color
                </label>

                <input
                  type="text"
                  value={color}
                  onChange={(e) =>
                    setColor(
                      e.target.value
                    )
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm font-bold"
                />
              </div>

              {/* GENDER */}

              <div className="space-y-1.5">

                <label className="text-xs font-bold text-slate-500 uppercase">
                  Gender
                </label>

                <input
                  type="text"
                  value={gender}
                  onChange={(e) =>
                    setGender(
                      e.target.value
                    )
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm font-bold"
                />
              </div>

              {/* SIZE */}

              <div className="space-y-1.5">

                <label className="text-xs font-bold text-slate-500 uppercase">
                  Size
                </label>

                <input
                  type="text"
                  value={size}
                  onChange={(e) =>
                    setSize(
                      e.target.value
                    )
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm font-bold"
                />
              </div>

              {/* MATERIAL */}

              <div className="space-y-1.5">

                <label className="text-xs font-bold text-slate-500 uppercase">
                  Material
                </label>

                <input
                  type="text"
                  value={material}
                  onChange={(e) =>
                    setMaterial(
                      e.target.value
                    )
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm font-bold"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT */}

        <div className="space-y-6">

          {/* COMPETITORS */}

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">

            <div className="flex justify-between items-center border-b border-slate-100 pb-3">

              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">

                <Globe className="w-4 h-4 text-blue-600" />

                Competitor Pricing
              </h3>

              <button
                type="button"
                onClick={
                  handleAddCompetitor
                }
                className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded text-blue-600 font-bold"
              >
                + Add
              </button>
            </div>

            {competitors.length ===
              0 ? (
              <p className="text-xs text-slate-400 text-center py-4">
                No competitors added
              </p>
            ) : (
              <div className="space-y-4">

                {competitors.map(
                  (
                    comp,
                    idx
                  ) => (
                    <div
                      key={idx}
                      className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 relative"
                    >

                      <button
                        type="button"
                        onClick={() =>
                          handleRemoveCompetitor(
                            idx
                          )
                        }
                        className="absolute top-2 right-2 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="grid grid-cols-2 gap-2">

                        <select
                          value={
                            comp.platform
                          }
                          onChange={(
                            e
                          ) => {
                            const updated =
                              [
                                ...competitors,
                              ];

                            updated[
                              idx
                            ].platform =
                              e.target.value;

                            setCompetitors(
                              updated
                            );
                          }}
                          className="w-full bg-white border border-slate-200 rounded px-2 py-2 text-xs"
                        >
                          <option value="AMAZON">
                            AMAZON
                          </option>

                          <option value="MYNTRA">
                            MYNTRA
                          </option>

                          <option value="AJIO">
                            AJIO
                          </option>

                          <option value="MEESHO">
                            MEESHO
                          </option>
                        </select>

                        <input
                          type="number"
                          value={
                            comp.price
                          }
                          onChange={(
                            e
                          ) =>
                            handleCompetitorPriceChange(
                              idx,
                              e.target
                                .value
                            )
                          }
                          className="w-full bg-white border border-slate-200 rounded px-2 py-2 text-xs"
                          placeholder="Price"
                        />
                      </div>

                      <input
                        type="text"
                        value={
                          comp.title
                        }
                        onChange={(
                          e
                        ) => {
                          const updated =
                            [
                              ...competitors,
                            ];

                          updated[
                            idx
                          ].title =
                            e.target.value;

                          setCompetitors(
                            updated
                          );
                        }}
                        className="w-full bg-white border border-slate-200 rounded px-2 py-2 text-xs"
                        placeholder="Competitor title"
                      />
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {/* MEDIA PREVIEW */}

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">

            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3">
              Media Preview
            </h3>

            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Extracted Frame"
                className="w-full h-52 object-contain rounded-lg border border-slate-200"
              />
            ) : (
              <div className="w-full h-52 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 text-xs font-bold">
                No frame extracted
              </div>
            )}
          </div>

          {/* ERROR */}

          {publishError && (
            <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex items-start gap-2 text-red-700 font-bold">

              <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" />

              <span className="text-xs">
                {publishError}
              </span>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}