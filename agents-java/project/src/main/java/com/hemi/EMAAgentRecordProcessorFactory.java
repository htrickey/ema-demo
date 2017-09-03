/*
 *  Copyright (c) 2017 Hemi Trickey; released under the "MIT license".
 *  See the LICENSE file packaged with this software for details.
 *
 */

package com.hemi;

import com.amazonaws.services.kinesis.clientlibrary.interfaces.IRecordProcessor;
import com.amazonaws.services.kinesis.clientlibrary.interfaces.IRecordProcessorFactory;

public class EMAAgentRecordProcessorFactory implements IRecordProcessorFactory {

    /**
     * {@inheritDoc}
     */
    @Override
    public IRecordProcessor createProcessor() {
        return new EMAAgentRecordProcessor();
    }
}
